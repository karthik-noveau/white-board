const settings={shape:"round",color:"white",structure:"elbow",pattern:"solid",weight:"regular"};
const node=(id,x,y,title,note,color="white",shape="round",root=false)=>({id,x,y,title,note,color,shape,root});
const edge=(id,from,to,side="right")=>({id,from,to,side,structure:"elbow",pattern:"solid",weight:"regular"});
const board=(nodes,edges,globalSettings={})=>({nodes,edges,globalSettings:{...settings,...globalSettings}});

export const templates=[
  {id:"product-roadmap",name:"Product roadmap",description:"Connect vision, bets, releases, and outcomes.",accent:"violet",board:board([
    node(1,1180,740,"Product vision","Where we are going","violet","round",true),node(2,1580,500,"Customer value","Problems worth solving","pink"),node(3,1580,740,"Strategic bets","What we believe","green"),node(4,1580,980,"Success signals","How we measure","amber"),node(5,1940,630,"Now","Current release"),node(6,1940,850,"Next","Upcoming opportunities")
  ],[edge(1,1,2),edge(2,1,3),edge(3,1,4),edge(4,3,5),edge(5,3,6)] )},
  {id:"project-plan",name:"Project plan",description:"Organize phases, owners, and delivery milestones.",accent:"blue",board:board([
    node(1,1180,760,"Project outcome","Definition of done","blue","soft",true),node(2,780,570,"Discover","Scope and constraints","amber"),node(3,780,930,"Prepare","People and resources","orange"),node(4,1580,570,"Build","Core delivery","green"),node(5,1580,760,"Launch","Release readiness","pink"),node(6,1580,950,"Learn","Review and improve","white")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6)])},
  {id:"customer-journey",name:"Customer journey",description:"Map stages, moments, emotions, and opportunities.",accent:"pink",board:board([
    node(1,650,760,"Discover","First signal","pink","pill",true),node(2,1000,760,"Consider","Explore options","white","pill"),node(3,1350,760,"Start","First experience","green","pill"),node(4,1700,760,"Adopt","Build a habit","blue","pill"),node(5,2050,760,"Advocate","Share the value","violet","pill"),node(6,1350,1010,"Opportunity","Remove first-run friction","amber","soft")
  ],[edge(1,1,2),edge(2,2,3),edge(3,3,4),edge(4,4,5),edge(5,3,6,"bottom")],{shape:"pill"})},
  {id:"swot",name:"SWOT analysis",description:"Balance internal strengths with external signals.",accent:"orange",board:board([
    node(1,1230,760,"Strategic position","What should we do?","orange","circle",true),node(2,780,500,"Strengths","Internal advantages","green","soft"),node(3,780,1000,"Weaknesses","Internal constraints","pink","soft"),node(4,1680,500,"Opportunities","External upside","blue","soft"),node(5,1680,1000,"Threats","External risk","amber","soft")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5)])},
  {id:"brainstorm",name:"Radial brainstorm",description:"Expand one idea in every direction.",accent:"green",board:board([
    node(1,1230,760,"Big idea","Explore without limits","green","circle",true),node(2,1230,390,"Why?","Purpose and impact","pink","ellipse"),node(3,1710,760,"What?","Possibilities","blue","ellipse"),node(4,1230,1130,"How?","Approaches","orange","ellipse"),node(5,750,760,"Who?","People involved","violet","ellipse"),node(6,1650,430,"Wild card","Unexpected angle","amber","pill")
  ],[edge(1,1,2,"top"),edge(2,1,3),edge(3,1,4,"bottom"),edge(4,1,5,"left"),edge(5,2,6)])},
  {id:"org-chart",name:"Team map",description:"Visualize teams, roles, and reporting lines.",accent:"violet",board:board([
    node(1,1230,400,"Leadership","Direction and alignment","violet","round",true),node(2,780,720,"Product","Strategy and discovery","blue"),node(3,1230,720,"Design","Experience and systems","pink"),node(4,1680,720,"Engineering","Platform and delivery","green"),node(5,650,990,"Research","Customer insight"),node(6,910,990,"Growth","Adoption"),node(7,1550,990,"Web","Experience"),node(8,1810,990,"Platform","Foundations")
  ],[edge(1,1,2,"bottom"),edge(2,1,3,"bottom"),edge(3,1,4,"bottom"),edge(4,2,5,"bottom"),edge(5,2,6,"bottom"),edge(6,4,7,"bottom"),edge(7,4,8,"bottom")])},
  {id:"decision-tree",name:"Decision tree",description:"Compare choices, evidence, and consequences.",accent:"amber",board:board([
    node(1,720,760,"Decision","What are we choosing?","amber","soft",true),node(2,1120,570,"Option A","Primary path","green"),node(3,1120,950,"Option B","Alternative path","blue"),node(4,1520,450,"Upside","Best outcome","white","pill"),node(5,1520,690,"Risk","What could fail","pink","pill"),node(6,1520,830,"Upside","Best outcome","white","pill"),node(7,1520,1070,"Risk","What could fail","orange","pill")
  ],[edge(1,1,2),edge(2,1,3),edge(3,2,4),edge(4,2,5),edge(5,3,6),edge(6,3,7)])},
  {id:"study-notes",name:"Study notes",description:"Connect concepts, evidence, and questions.",accent:"blue",board:board([
    node(1,1180,720,"Core concept","Course or chapter","blue","soft",true),node(2,760,500,"Definition","Explain simply","white","rectangle"),node(3,760,940,"Key question","What is unresolved?","pink","rectangle"),node(4,1580,450,"Principle one","Essential idea","green","round"),node(5,1580,720,"Principle two","Supporting idea","amber","round"),node(6,1580,990,"Example","Apply the concept","orange","round")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6)],{pattern:"dotted"})},
  {id:"retrospective",name:"Team retrospective",description:"Reflect on wins, friction, and next actions.",accent:"green",board:board([
    node(1,1230,500,"Sprint review","Learn together","green","pill",true),node(2,760,820,"Went well","Keep doing","green","soft"),node(3,1230,820,"Was difficult","Understand friction","pink","soft"),node(4,1700,820,"Try next","Small experiments","blue","soft"),node(5,760,1080,"Celebrate","Recognize the team","white","pill"),node(6,1230,1080,"Root cause","Look beneath","orange","pill"),node(7,1700,1080,"Owner + date","Make it real","amber","pill")
  ],[edge(1,1,2,"bottom"),edge(2,1,3,"bottom"),edge(3,1,4,"bottom"),edge(4,2,5,"bottom"),edge(5,3,6,"bottom"),edge(6,4,7,"bottom")])},
  {id:"content-system",name:"Content system",description:"Plan themes, channels, stories, and cadence.",accent:"orange",board:board([
    node(1,1180,740,"Editorial direction","What we want to own","orange","round",true),node(2,780,520,"Audience","Who we serve","pink","pill"),node(3,780,960,"Voice","How we sound","violet","pill"),node(4,1580,470,"Theme one","Teach","blue","soft"),node(5,1580,650,"Theme two","Inspire","green","soft"),node(6,1580,830,"Theme three","Prove","amber","soft"),node(7,1580,1010,"Theme four","Invite","orange","soft")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6),edge(6,1,7)],{structure:"curve"})},
];
