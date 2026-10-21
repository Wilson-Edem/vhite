console.log("flagged");
console.error("not flagged");
const obj = { console: { log() {} } };
obj.console.log("not flagged");
