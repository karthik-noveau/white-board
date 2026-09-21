// Track independent board/title writes without allowing an older completion to
// mark a newer edit as saved. The caller also marks the debounce period pending.
export function createSaveStatus(onChange) {
  const channels = new Map();
  let revision = 0;
  let status = "saved";

  const publish = () => {
    const states = [...channels.values()].map(channel => channel.status);
    const next = states.includes("error") ? "error" : states.includes("saving") ? "saving" : "saved";
    if (next !== status) { status = next; onChange(next); }
  };

  return {
    getStatus: key => key === undefined ? status : channels.get(key)?.status || "saved",
    markDirty(key) {
      const token = ++revision;
      channels.set(key, { token, status: "saving" });
      publish();
      return token;
    },
    async persist(key, token, write) {
      const update = next => {
        if (channels.get(key)?.token !== token) return;
        channels.set(key, { token, status: next });
        publish();
      };
      update("saving");
      try {
        const result = await write();
        if (result?.ok === false) throw result.error || new Error("Could not save changes");
        update("saved");
        return true;
      } catch {
        update("error");
        return false;
      }
    },
  };
}
