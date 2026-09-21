import { useCallback, useRef, useState } from "react";
import DeleteConfirmation from "../components/DeleteConfirmation";
import MotionPresence from "../components/MotionPresence";

/** Keep deletion callbacks pending until an explicit confirmation. */
export default function useDeleteConfirmation() {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const requestDelete = useCallback(options => {
    pending.current = options;
    setRequest(options);
  }, []);
  const cancel = useCallback(() => {
    pending.current = null;
    setRequest(null);
  }, []);
  const confirm = () => {
    if (!request || pending.current !== request) return;
    cancel();
    request.onConfirm();
  };
  const dialog = <MotionPresence present={Boolean(request)}>
    {request && <DeleteConfirmation {...request} onConfirm={confirm} onClose={cancel}/>}
  </MotionPresence>;
  return [requestDelete, dialog];
}
