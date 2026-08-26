// LIFE SKILL ONTOLOGY v1: broad domains are bundled; individual progress stays in the player's save data.
const domains = [
  ["human-basics","HUMAN BASICS",["Walking","Running","Balance","Fine Motor Control","Hand-Eye Coordination","Reading","Listening","Speech","Memory Recall","Attention Control","Self Care","Mobile Device Operation"]],
  ["language","LANGUAGE & COMMUNICATION",["Japanese","Written Japanese","Conversation","Public Speaking","Active Listening","Foreign Language Learning","Translation","Writing","Storytelling","Negotiation","Presentation","Nonverbal Communication"]],
  ["cognition","COGNITION",["Logical Reasoning","Problem Solving","Information Research","Critical Thinking","Systems Thinking","Pattern Recognition","Observation","Decision Making","Learning Strategy","Mental Modelling","Planning","Time Estimation"]],
  ["digital","DIGITAL",["Typing","Touch Typing","File Management","Web Literacy","Data Literacy","Programming","Debugging","Automation","AI Tools","Digital Security","UX Literacy","Online Research"]],
  ["creative","CREATIVE",["Visual Design","Photography","Illustration","Music Listening","Music Performance","Video Editing","Creative Writing","Idea Generation","Colour Theory","Composition","Art Direction","Creative Critique"]],
  ["daily-life","DAILY LIFE",["Cooking","Food Safety","Meal Planning","Cleaning","Laundry","Money Handling","Shopping","Home Organisation","Sleep Routine","Personal Care","Wardrobe Management","Emergency Preparation"]],
  ["physical","PHYSICAL",["Strength Training","Endurance","Flexibility","Posture","Breathing","Recovery","Rhythm","Dance","Swimming","Cycling","Sport Strategy","Body Awareness"]],
  ["world","WORLD & NAVIGATION",["Map Reading","Route Planning","Urban Navigation","Public Transit","Exploration","Weather Awareness","Travel Planning","Place Memory","Risk Awareness","Outdoor Safety","Local Discovery","Wayfinding"]],
  ["social","SOCIAL",["Empathy","Perspective Taking","Conflict Resolution","Collaboration","Boundary Setting","Relationship Maintenance","Facilitation","Mentoring","Community Participation","Hospitality","Interviewing","Feedback"]],
  ["business","BUSINESS & WORK",["Project Management","Requirements Analysis","Documentation","Meeting Design","Task Prioritisation","Customer Understanding","Budgeting","Sales Conversation","Operations","Leadership","Career Planning","Professional Ethics"]],
  ["science","SCIENCE & KNOWLEDGE",["Scientific Method","Mathematics","Statistics","Experiment Design","Data Interpretation","Biology","Chemistry","Physics","Psychology","History","Geography","Economics"]],
  ["engineering","ENGINEERING & MAKING",["Tool Handling","Prototyping","Mechanical Reasoning","Electronics","Repair","3D Modelling","Architecture Literacy","Construction Safety","Material Knowledge","Quality Control","Technical Drawing","Process Design"]],
  ["nature","NATURE & LIFE",["Plant Recognition","Animal Recognition","Ecology","Seasonal Awareness","Gardening","Foraging Safety","Stargazing","Geology","Weather Reading","Nature Photography","Conservation","Field Observation"]],
  ["culture","CULTURE & SOCIETY",["Film Literacy","Literature","Museum Literacy","Food Culture","Fashion Literacy","Religion Literacy","Cultural History","Media Literacy","Civic Literacy","Etiquette","Festival Knowledge","Travel Culture"]],
  ["craft","CRAFT & MATERIAL",["Sewing","Knitting","Woodworking","Ceramics","Paper Craft","Calligraphy","Baking","Flower Arrangement","Makeup","Nail Care","Leatherwork","Instrument Care"]]
];

const composite = [
  ["structured-writing","Structured Writing",["language","cognition"]], ["technical-writing","Technical Writing",["structured-writing","business","digital"]], ["information-communication","Information Communication",["technical-writing","creative","social"]], ["world-routing","World Routing",["world","cognition","daily-life"]], ["meal-preparation","Meal Preparation",["daily-life","cognition"]], ["creative-technology","Creative Technology",["creative","digital"]], ["research-synthesis","Research Synthesis",["cognition","science","language"]], ["digital-production","Digital Production",["digital","business","creative"]], ["life-design","Life Design",["daily-life","planning","world"]]
];

export const skillNodes = domains.flatMap(([id,label,skills], domainIndex) => {
  const angle = -Math.PI / 2 + domainIndex * (Math.PI * 2 / domains.length); const x = 500 + Math.cos(angle) * 270; const y = 360 + Math.sin(angle) * 220;
  const root = { id, label, domain:label, kind:"cluster", requires:[], x, y };
  return [root, ...skills.map((skill,index) => { const branchAngle = angle + (index - (skills.length - 1) / 2) * .105; return { id:`${id}-${index}`, label:skill, domain:label, kind:"skill", requires:[id], x:500 + Math.cos(branchAngle) * (345 + (index % 3) * 24), y:360 + Math.sin(branchAngle) * (285 + (index % 3) * 20) }; })];
}).concat(composite.map(([id,label,requires], index) => ({ id,label,domain:"COMPOSITE",kind:"composite",requires,x:410 + (index % 3) * 92,y:285 + Math.floor(index / 3) * 78 })));

export const skillDomains = domains.map(([id,label]) => ({ id,label }));
