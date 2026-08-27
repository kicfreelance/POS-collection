process.env.DATABASE_URL="postgresql://pos:pos_dev_password@127.0.0.1:54329/pos";
process.env.POS_DB_PORT="54329";process.env.POS_DB_USER="pos";process.env.POS_DB_PASSWORD="pos_dev_password";process.env.POS_DB_NAME="pos";
const path=await import("node:path"),fs=await import("node:fs");
const {createRequire}=await import("node:module");const require=createRequire("C:/Users/Onyx/POS/pos-app/package.json");
const root="C:/Users/Onyx/POS/pos-app",dataDir=path.join(root,".pgdata");
const EmbeddedPostgres=(await import("embedded-postgres")).default;
const pg=new EmbeddedPostgres({databaseDir:dataDir,port:54329,user:"pos",password:"pos_dev_password",authMethod:"password",persistent:true});
const pf=path.join(dataDir,"postmaster.pid");
try{const pid=parseInt(fs.readFileSync(pf,"utf8").split("\n")[0].trim(),10);let a=false;try{process.kill(pid,0);a=true}catch(e){a=e.code==="EPERM"}if(!a)fs.rmSync(pf,{force:true})}catch{}
if(!fs.existsSync(path.join(dataDir,"PG_VERSION")))await pg.initialise();
await pg.start();
try{await pg.createDatabase("pos")}catch(e){if(!/already exists/i.test(e.message))throw e}
const {runMigrations}=require(path.join(root,"dist-electron/db/migrate.js"));await runMigrations(path.join(root,"db","migrations"));
const {seedDatabase}=require(path.join(root,"dist-electron/db/seed.js"));await seedDatabase();
const {Client}=require("pg");const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const b=require("bcryptjs");await c.query("UPDATE users SET pin_hash=$1 WHERE username='admin'",[await b.hash("123456",10)]);
await c.query("UPDATE business_settings SET business_type='retail' WHERE id=true");
const u=(await c.query("SELECT id FROM users WHERE username='admin'")).rows[0].id;
if(!(await c.query("SELECT 1 FROM shifts WHERE cashier_id=$1 AND status='open'",[u])).rows[0])
  await c.query("INSERT INTO shifts (cashier_id,status,opening_float,opened_at) VALUES ($1,'open',0,now())",[u]);
await c.end();
console.log("DB_READY admin/123456 shift-open");setInterval(()=>{},1<<30);
