// Web server for Supply Chain User Interface (run by "node index.js" and connect by browsing to http://localhost:3000)
// You should have Wiv Supply Chain node (Substrate) running in the same machine
// You should have IPFS node (www.ipfs.io) running in the same machine for storing images
console.log("100 - Web Server for Supply Chain - ver. 1.00 - Starting");
let express = require('express');
const { ApiPromise, WsProvider } = require('@polkadot/api');   
const { Keyring } = require('@polkadot/api');
const multer = require('multer');
const { mainModule } = require('process');
const { naclDecrypt,naclEncrypt,randomAsU8a,cryptoWaitReady, mnemonicGenerate} = require('@polkadot/util-crypto'); 
const { u8aToHex,stringToU8a,u8aToString } =require('@polkadot/util');

const crypto = require('crypto');
const cookieParser = require('cookie-parser')
// customization section - you can change the following constants upon your preferences
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const PATHKEYS="wivkeys";             //path where to store the encrypted login data
const PATHLOGS="wivlogs";             //path where to store logs for each user
const PATHUPLOADS="wivuploads/";      //path where to store uploaded files for each user
const SECRET="4191ecdd49b1dc6b03020c2ea44a79e276c69f30"; //change THIS for your installation, it's used to encrypt the session token
const MYSQLIPADDRESS="127.0.0.1";     // ip address of Mysql/Mariadb server (standard port 3306)
const MYSQLUSERNAME="root";           // username to use for Mysql connection
const MYSQLPWD="Aszxqw1234";          // password of the username above
// end customization section 
let SECRETSHA256='';  //global var for SH256 computing
// execute main loop as async function because of "await" requirements that cannot be execute from the main body
mainloop();
// main loop function
async function mainloop(){
    let fs = require('fs');
    //connect to local substrate node (it will retry automatically the connection if not reachable)
    const api = await ApiPromise.create({ provider: wsProvider });   
    //setup express+multer modules (http server + file upload management)
    let app = express();
    const upload = multer({
        dest: PATHUPLOADS // this saves your file into a directory called "wivuploads/" or as changed int the customization section
    }); 
    app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    app.use(cookieParser());
    // compute sha256 of SECRET
    const hashSECRET = crypto.createHash('sha256');
    hashSECRET.on('readable', () => {
        const data = hashSECRET.read();
    });
    hashSECRET.write(SECRET);
    hashSECRET.end();
    SECRETSHA256=hashSECRET.digest();
    //inizialize Wasm engine for polkadot-keyring-ui
    /*cryptoWaitReady().then(() => {
        // load all available addresses and accounts
        keyring.loadAll({ ss58Format: 42, type: 'sr25519' });
        console.log("Keyring loaded");
    });*/
    //creating folder for logs storage
    if (!fs.existsSync("./"+PATHLOGS)) {
        fs.mkdir("./"+PATHLOGS, function(err) {
            if (err) {
                console.log(err)
            } else {
                console.log("120 - New directory "+PATHLOGS+" successfully created.")
            }
        });
    }
    createDatabase();
    //routing for the web paths
    //main dashboard loaded from index.html
    app.get('/',function(req,res){             
        let v=read_file("index.html");
        res.send(v);
    });
    // new asset submission
    app.post('/addasset', upload.single('inputMainPhoto'), (req, res) => {
        let sessiontoken=req.cookies['sessiontoken'];
        store_asset(req.file.path,req.body,api,sessiontoken,req.file.originalname);
        res.redirect("/");
    });
    //login
    app.post('/login',function(req, res) {
        const fs = require('fs')
        let filename="./"+PATHKEYS+"/"+req.body.userName+".enc";
        if (!fs.existsSync(filename)) {
            res.cookie('loginFormError', encodeURI("Wrong password or username not present"));
            res.cookie('loginFormUserName', encodeURI(req.body.userName));
            res.redirect("/");
        }
        else{
            // read once+encrypted seed from local storage
            fs.readFile(filename, 'utf8' , (err, data) => {
                if (err) {
                    res.cookie('loginFormError', encodeURI("Wrong password or username not present"));
                    res.cookie('loginFormUserName', encodeURI(req.body.userName));
                    res.redirect("/");
                }
                let b = data.split('###');
                let nonceb64=b[0];
                let encseedb64=b[1];
                //calculate the sha256 of received password
                const hash = crypto.createHash('sha256');
                hash.on('readable', () => {
                    const data = hash.read();
                    if (data) {
                        console.log("hash: "+data.toString('hex'));
                    }
                });
                hash.write(req.body.passwordLogin);
                hash.end();
                let secret=hash.digest();
                //decode from base64 to 
                const nonce = Buffer.from(nonceb64,'base64');
                const encseed = Buffer.from(encseedb64,'base64');
                const securityseedarray = naclDecrypt(encseed, nonce, secret);
                if (securityseedarray==null){
                    res.cookie('loginFormError', encodeURI("Wrong password or username not present"));
                    res.cookie('loginFormUserName', encodeURI(req.body.userName));
                }
                else{
                    // set cookie and write log for successfully login
                    // make a token with encrypted username and security seed (random nonce every time)
                    const securityseed=String.fromCharCode.apply(0, securityseedarray)
                    console.log("Decrypted securityseed: " +securityseed);
                    let sessiontoken=generateSessionToken(securityseed,req.body.userName);
                    //set session token cookie (url encoded)
                    res.cookie('sessiontoken', encodeURI(sessiontoken));
                    res.clearCookie('loginFormError');
                    //clean previous log
                    let b = sessiontoken.split('###');
                    let username=Buffer.from(b[0],'base64');
                    let filenamelog='./'+PATHLOGS+'/'+username+".log";
                    if(fs.existsSync(filenamelog)){
                        fs.unlinkSync(filenamelog);
                    }
                    //write session log
                    write_log("[info] - user "+req.body.userName+" has logged in.",sessiontoken);
                }
                res.redirect("/");    
            });
        }
        
    });
    //logout
    app.post('/logout',function(req, res) {
        const fs = require("fs")
        sessiontoken=req.cookies.sessiontoken;
        if(sessiontoken!=undefined){
            let b = sessiontoken.split('###');
            let username=Buffer.from(b[0],'base64');
            let filename='./'+PATHLOGS+'/'+username+".log";
            console.log('remove: '+filename);
            fs.unlinkSync(filename);
        }
        //clear all cookies
        res.clearCookie('loginFormError');
        res.clearCookie('sessiontoken');
        res.clearCookie('loginFormUserName');
        res.clearCookie('userNameSignup');
        res.clearCookie('securitySeedSignup');
        res.clearCookie('passwordSignup');
        res.clearCookie('passwordSignupR');
        res.clearCookie('signupFormUsernameError');
        res.redirect("/");    
    });
    //signup
    app.post('/signup',function(req, res) {
        const fs = require("fs")
        let filename="./"+PATHKEYS+"/"+req.body.userNameSignup+".enc";
        if(fs.existsSync(filename)){
            res.cookie('signupFormUsernameError', "User name is already present, please change it."); 
            res.cookie('userNameSignup',encodeURI(req.body.userNameSignup));
            res.cookie('securitySeedSignup',encodeURI(req.body.securitySeedSignup));
            res.cookie('passwordSignup',encodeURI(req.body.passwordSignup));
            res.cookie('passwordSignupR',encodeURI(req.body.passwordSignupR));
            console.log("[info] Failed attempt to signup with an username already present");
            res.redirect("/");   
        }
        const keyring = new Keyring({ type: 'sr25519' });
        const keyspair = keyring.addFromUri(req.body.securitySeedSignup,{ name: req.body.userNameSignup });
        console.log(`[info] Signup - ${keyspair.meta.name}: has address ${keyspair.address} with publicKey [${keyspair.publicKey}]`);
        const accountid=`${keyspair.address}`;
        if (!fs.existsSync("./"+PATHKEYS)) {
            fs.mkdir("./"+PATHKEYS, function(err) {
                if (err) {
                    console.log(err)
                } else {
                    console.log("110 - New directory "+PATHKEYS+" successfully created.")
                }
            });
        }
        // make sha256 of the password set
        const hash = crypto.createHash('sha256');
        hash.on('readable', () => {
            const data = hash.read();
            if (data) {
                console.log("hash: "+data.toString('hex'));
            }
        });
        hash.write(req.body.passwordSignup);
        hash.end();
        secret=hash.digest();
        //encrypt security seed
        const { encrypted, nonce } = naclEncrypt(stringToU8a(req.body.securitySeedSignup), secret);
        let de = Buffer.from(encrypted);
        let d64 = de.toString('base64');
        let n = Buffer.from(nonce);
        let n64 = n.toString('base64');
        let encb64=n64+"###"+d64;
        //store security seed
        console.log("filename: "+filename);
        console.log("encryptedkeys:"+encb64);
        fs.writeFile(filename, encb64, function (err) {
            if (err) {
              return console.log(err);
            }
          });
        //store users in users table
        store_username_db(req.body.userNameSignup,accountid,encb64);
        //make automatic login after signup
        sessiontoken=generateSessionToken(req.body.securitySeedSignup,req.body.userNameSignup);
        res.cookie('sessiontoken', encodeURI(sessiontoken));
        res.clearCookie('loginFormError');
        //write session log
        write_log("[info] - user "+req.body.userNameSignup+" has logged in.",sessiontoken);
        res.redirect("/");
    });
    //get last block written on the blockchain
    app.route('/lastblock').get(function(req,res)
    {
        get_last_block(res,api);
    });
    // get a random seed (24 words)
    app.route('/randomseed').get(function(req,res)
    {
        const randomseed = mnemonicGenerate(24);
        let j='{"randomseed":"'+randomseed+'"}';
        res.send(j);
    });
    //get last log data
    app.route('/logdata').get(function(req,res)
    {
        const fs = require('fs')
        sessiontoken=req.cookies.sessiontoken;
        let logh='<center><h2>Events</h2></center><table class="table table-striped"><tr><th>Date/Time</th><th>Event Description</th><tr>';
        let logf='</table>'
        if(sessiontoken==undefined){
            res.send(logh+logf);
        }else{
            let b = sessiontoken.split('###');
            let username=Buffer.from(b[0],'base64');
            let filename='./'+PATHLOGS+'/'+username+".log";
            let log=read_file(filename);
            let logf='</table>'
            let logr=log.split("\n");
            let logs=logh;
            let lst=logs.length-1;
            for(i=lst;i>=0;i--){
                if(logr[i]==undefined)
                    continue;
                if(logr[i].length==0)
                    continue;
                logs=logs+logr[i];
            }
            logs=logs+logf;
            res.send(logs);
        }
        
    });
    //get last log data
    app.route('/assetslist').get(function(req,res)
    {
        const fs = require('fs')
        sessiontoken=req.cookies.sessiontoken;
        let logh='<table class="table table-striped"><tr><th>Date/Time</th><th>Event Description</th><tr>';
        let logf='</table>'
        if(sessiontoken==undefined){
            res.send(logh+logf);
        }else{
            assetsList(res);
        }
        
    });
    //edit asset submission
    app.route('/editasset').get(function(req,res)
    {
        res.send("");
        console.log(req.query.v);
    });
    //edit asset submission
    app.route('/debug').get(function(req,res)
    {
        const accounts = keyring.getAccounts();
        accounts.forEach(({ address, meta, publicKey }) =>
        console.log(address, JSON.stringify(meta), u8aToHex(publicKey))
    );
    });
    
    // logo output
    app.route('/logo').get(function(req,res)
    {
        let s = fs.createReadStream("logo.png");
        s.on('open', function () {
            res.set('Content-Type', 'image/png');
            s.pipe(res);
        });
        s.on('error', function () {
            res.set('Content-Type', 'text/plain');
            res.status(404).end('logo.png not found');
        });
    });

    // listening to server port
    console.log("101 - listening for connections on port 3000...");
    let server=app.listen(3000,function() {});
}

//function to get last block of the blockchain
async function get_last_block(res,api){
    const lastHeader = await api.rpc.chain.getHeader();                
    res.send(lastHeader);
}
//function to return content of a file name
function read_file(name){
    const fs = require('fs');
    try {
        const data = fs.readFileSync(name, 'utf8')
        return(data);
      } catch (err) {
        console.error(err);
        return(undefined);
      }
}
// function to store assets in ipfs + blockchain
async function store_asset(filename,body,api,sessiontoken,originalfilename){
    const IpfsHttpClient = require('ipfs-http-client');
    const { globSource } = IpfsHttpClient;
    const ipfs = IpfsHttpClient();
    let file = await ipfs.add(globSource(filename));
    let ipfsname=`${file.cid}`;
    ipfsname.replace("CID(","");
    ipfsname.replace(")","");
    //compute sha256 of SECRET
    const hashSECRET = crypto.createHash('sha256');
    hashSECRET.on('readable', () => {
        const data = hashSECRET.read();
    });
    hashSECRET.write(SECRET);
    hashSECRET.end();
    let SECRETSHA256=hashSECRET.digest();
    //decrypt security seed from sessiontoken
    let sessiontokendecoded = decodeURIComponent(sessiontoken);
    let b = sessiontokendecoded.split('###');
    let usernameb64=b[0];
    let nonceb64=b[1];
    let encseedb64=b[2];
    const username = Buffer.from(usernameb64,'base64');
    const nonce = Buffer.from(nonceb64,'base64');
    const encseed = Buffer.from(encseedb64,'base64');
    let securityseedu8 = naclDecrypt(encseed, nonce, SECRETSHA256);
    let securityseed =u8aToString(securityseedu8);
    const keyring = new Keyring({ type: 'sr25519' });
    const loggeduser = keyring.addFromUri(securityseed,{ name: username });
    write_log(`[info] Adding Asset - S/N: ${body.assetSerialNumber} - Request has been queued`,sessiontoken);
    console.log(`[info] Adding Asset - S/N: ${body.assetSerialNumber} - Request has been queued`);
    let assetdata=body.assetDescription;
    const unsub = await api.tx.wivSupplyChain.newAsset(assetdata).signAndSend(loggeduser,(result) => {
        if (result.status.isInBlock) {
            console.log(`[info] Adding Asset - Transaction included at blockHash ${result.status.asInBlock}`);
            write_log(`[info] Adding Asset - Transaction included at blockHash ${result.status.asInBlock}`,sessiontoken);
          } else if (result.status.isFinalized) {
            console.log(`[info] Added Asset - Transaction finalized at blockHash ${result.status.asFinalized}`);
            write_log(`[info] Added Asset - Transaction finalized at blockHash ${result.status.asFinalized}`,sessiontoken);
            //store assets in database
            store_asset_db(`${loggeduser.address}`,`${result.status.asFinalized}`,body,ipfsname,originalfilename);
            unsub();
          }
    });
}
//function to add 
function write_log(d,sessiontoken){
    let b = sessiontoken.split('###');
    let username=Buffer.from(b[0],'base64');
    const fs = require('fs')
    let filename='./'+PATHLOGS+'/'+username+".log";
    console.log("130 - Writing log to "+filename+" ["+d+"]");
    let dt=new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    //dtlog='<div class="row"><div class="col-sm">'+dt+'</div><div class="col-sm">'+d+'</div></div>\n';
    let dtlog='<tr><td>'+dt+'</td><td>'+d+'</td></tr>\n';
    fs.appendFileSync(filename, dtlog, 'utf8');
}
//function to generate sessiontoken encrypting the security seed with the system password
function generateSessionToken(securityseed,username){
    //encrypt security seed (encrypted and nonce names cannot be changed to work with naclEncrypt)
    let { encrypted, nonce } = naclEncrypt(stringToU8a(securityseed), SECRETSHA256);
    let de = Buffer.from(encrypted);
    let encryptedb64 = de.toString('base64');
    let n = Buffer.from(nonce);
    let nonceb64 = n.toString('base64');
    let ub = Buffer.from(username);
    let usernameb64 = ub.toString('base64');
    // build session token
    let sessiontoken=usernameb64+"###"+nonceb64+"###"+encryptedb64;
    console.log("generate session token:"+sessiontoken);
    return(sessiontoken);
}
// function to store an asset in the assets table
async function store_asset_db(account,transactionid,body,ipfsphotoaddress,ipfsphotofilename){
    connection= await connect_database();
    let sqlquery= "INSERT INTO wivsupplychain.assets set serialnumber=?,description=?,ipfsphotoaddress=?,ipfsphotofilename=?,accountowner=?,transactionid=?,dttransaction=now()";
    connection.query(
        {sql: sqlquery,
        values: [body.assetSerialNumber,body.assetDescription,ipfsphotoaddress,ipfsphotofilename,account,transactionid]},
        function (error, results, fields) {
        if (error) throw error;
    });
    connection.end();  
}
//function to connect to the database wiwsupplychain
async function connect_database(){
    //connection to mysql/mariadb database 
    let mysql= require('mysql');
    let connection = mysql.createConnection({
        host     : MYSQLIPADDRESS,
        user     : MYSQLUSERNAME,
        password : MYSQLPWD,
        database : 'wivsupplychain',
    });
    connection.connect();
    return(connection);
}
// function to store an asset in the assets table
async function store_username_db(username,accountid,ecnryptedseed){
    connection= await connect_database();
    let sqlquery= "INSERT INTO users set username=?,accountid=?,encryptedseed=?,dtcreation=now()";
    connection.query(
        {sql: sqlquery,
        values: [username,accountid,ecnryptedseed]},
        function (error, results, fields) {
        if (error) throw error;
    });
    connection.end();  
}
// function to send back the assets list of the logged user (search for accountid)
async function assetsList(res){
    let b = sessiontoken.split('###');
    let usernameb=Buffer.from(b[0],'base64');
    let username=`${usernameb}`;
    connection= await connect_database();
    let sqlquery= "SELECT * FROM users WHERE username=?";
    await connection.query(
        {sql: sqlquery,
        values: [username]},
        function (error, results, fields) {
        if (error) throw error;
        assetsListBody(connection,results[0].accountid,res)
    });

}
// function to send back the assets list of the logged user (search for assets)
async function assetsListBody(connection,accountid,res){
    let al='<center><h2>Assets</h2></center><table class="table table-striped"><tr><th>Id</th><th>Serial Number</th><th>Description</th><th>Dt Creation</th><th>Dt Verification</th><tr>';
    let sqlquery= "SELECT * FROM assets WHERE accountowner=? order by id desc";
    await connection.query(
        {sql: sqlquery,
        values: [accountid]},
        function (error, results, fields) {
        if (error) throw error;
        for (i = 0; i < results.length; i++) { 
            al=al+"<tr><td>"+results[i].id+"</td>";
            al=al+"<td>"+results[i].serialnumber+"</td>";
            al=al+"<td>"+results[i].description+"</td>";
            let dtt=`${results[i].dttransaction}`
            al=al+"<td>"+dtt.substr(0,15)+"</td>";
            let dtc=`${results[i].dtapproval}`
            if(dtc=="null"){
                dtc="Pending"
            }
            al=al+"<td>"+dtc+"</td>";
            al=al+"</tr>"
        }
        al=al+"</table>";
        res.send(al);
    });     
    connection.end();  
}
// function to create the database and the required table
function createDatabase(){
    //connection to mysql/mariadb database and creation of the database
    let mysql= require('mysql');
    let connection = mysql.createConnection({
        host     : MYSQLIPADDRESS,
        user     : MYSQLUSERNAME,
        password : MYSQLPWD,
    });
    connection.connect();
    connection.query('CREATE DATABASE IF NOT EXISTS wivsupplychain',function (error, results, fields) {
        if (error) throw error;
    });
    connection.query('USE wivsupplychain',function (error, results, fields) {
        if (error) throw error;
    });
    //creation of table assets
    let q=`CREATE TABLE IF NOT EXISTS assets(\n`+
                `id INT AUTO_INCREMENT PRIMARY KEY,\n`+
                `serialnumber VARCHAR(64) DEFAULT '' NOT NULL,\n`+
                `description VARCHAR(256) DEFAULT '' NOT NULL,\n`+
                `ipfsphotoaddress VARCHAR(64) DEFAULT '' NOT NULL,\n`+
                `ipfsphotofilename VARCHAR(128) DEFAULT '' NOT NULL,\n`+
                `metadata VARCHAR(8192) DEFAULT '' NOT NULL,\n`+
                `accountowner VARCHAR(64) DEFAULT '' NOT NULL,\n`+
                `accountapprover VARCHAR(64) DEFAULT '' NOT NULL,\n`+
                `transactionid varchar(128) DEFAULT '' NOT NULL,\n`+
                `dttransaction DATETIME NOT NULL,\n`+
                `dtapproval DATETIME NOT NULL,\n`+
                `transfertransactionid varchar(128) DEFAULT '' NOT NULL,\n`+
                `dttransfertransaction DATETIME\n`+
                `)`;
    //console.log(q);
    connection.query(q,function (error, results, fields) {
        if (error) throw error;
    });
    //creation of table assets
     q=`CREATE TABLE IF NOT EXISTS users(\n`+
                `id INT AUTO_INCREMENT PRIMARY KEY,\n`+
                `username VARCHAR(64) DEFAULT '' NOT NULL,\n`+
                `accountid VARCHAR(128) DEFAULT '' NOT NULL,\n`+
                `encryptedseed VARCHAR(512) DEFAULT '' NOT NULL,\n`+
                `dtcreation DATETIME NOT NULL\n`+
                `)`;
    connection.query(q,function (error, results, fields) {
                    if (error) throw error;
    });
    connection.end();  
}
