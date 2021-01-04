// Web server for Supply Chain User Interface (run by "node index.js" and connect by browsing to http://localhost:3000)
// You should have Wiv Supply Chain node (Substrate) running in the same machine
// You should have IPFS node (www.ipfs.io) running in the same machine for storing images
// You should have MYSQL server (www.mysql.org) running in the same machine.

console.log("[info] - Web Server for Supply Chain - ver. 1.00 - Starting");
let express = require('express');
const { ApiPromise, WsProvider } = require('@polkadot/api');   
const { Keyring } = require('@polkadot/api');
const multer = require('multer');
const { mainModule } = require('process');
const { naclDecrypt,naclEncrypt,mnemonicGenerate} = require('@polkadot/util-crypto'); 
const { u8aToHex,stringToU8a,u8aToString,hexToU8a,isHex } =require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/keyring');

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
                console.log("[info] - New directory "+PATHLOGS+" successfully created.")
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
    //main ADMIN dashboard loaded from admin.html
    app.get('/admin',function(req,res){             
        let v=read_file("admin.html");
        res.send(v);
    });
    // new asset submission
    app.post('/addasset', upload.single('inputMainPhoto'), (req, res) => {
        let sessiontoken=req.cookies['sessiontoken'];
        store_asset(req.file.path,req.body,api,sessiontoken,req.file.originalname);
        res.redirect("/");
    });
    // transfer asset submission
    app.post('/transferasset',function(req, res) {
        transferAsset(req,res,api);
    });
    //view asset details (show modal form)
    app.get('/viewasset',function(req,res){             
        if(req.query.assetid>0){
            res.cookie('viewAsset', encodeURI(req.query.assetid));
            res.redirect("/");
        }else{
            res.redirect("/");
        }
    });
    // call the function to show the details (we call an async function)
    app.get('/viewassetdetails',function(req,res){  
        viewAssetDetails(req,res);
    });
    // photo download from IPFS 
    app.route('/photoasset').get(function(req,res)
    {
        getHttpFileIpfs(res,req.query.ipfsphotoaddress,req.query.ipfsphotofilename);
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
                        console.log("[info] hash of received password: "+data.toString('hex'));
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
                if(req.body.userName=="Admin")
                    res.redirect("/admin");    
                else
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
            fs.unlinkSync(filename);
        }
        //clear all cookies
        res.clearCookie('loginFormError');
        res.clearCookie('sessiontoken');
        res.clearCookie('loginFormUserName');
        res.clearCookie('userNameSignup');
        res.clearCookie('securitySeedSignup');
        res.clearCookie('signupFormUsernameError');
        res.redirect("/");    
    });
    //signup
    app.post('/signup',function(req, res) {
        res.clearCookie('signupFormUsernameError'); 
        res.clearCookie('userNameSignup');
        res.clearCookie('securitySeedSignup');
        const fs = require("fs")
        let filename="./"+PATHKEYS+"/"+req.body.userNameSignup+".enc";
        if(fs.existsSync(filename)){
            res.cookie('signupFormUsernameError', "User name is already present, please change it."); 
            res.cookie('userNameSignup',encodeURI(req.body.userNameSignup));
            res.cookie('securitySeedSignup',encodeURI(req.body.securitySeedSignup));
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
                    console.log("error] - ",err)
                } else {
                    console.log("[info] - New directory "+PATHKEYS+" successfully created.")
                }
            });
        }
        // make sha256 of the password set
        const hash = crypto.createHash('sha256');
        hash.on('readable', () => {
            const data = hash.read();
            if (data) {
                console.log("[info] hash: "+data.toString('hex'));
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
        fs.writeFile(filename, encb64, function (err) {
            if (err) {
              return console.log("[error] - ",err);
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
    console.log("[info] - listening for connections on port 3000...");
    let server=app.listen(3000,function() {});
}

//function to get last block of the blockchain
async function get_last_block(res,api){
    const lastHeader = await api.rpc.chain.getHeader();                
    res.send(lastHeader);
}
// function to send and back a file content for http request
async function getHttpFileIpfs(res,ipfsaddress,ipfsfilename){
    const fs = require('fs');
    const IpfsHttpClient = require('ipfs-http-client');
    const ipfs = IpfsHttpClient();
    if(ipfsaddress.length==0){
        res.set('Content-Type', 'text/plain');
        res.status(404).end('IPFS file not found');
    }else{
        if(ipfsfilename.toLowerCase().indexOf(".png")!=-1)
            res.set('Content-Type', 'image/png');
        if(ipfsfilename.toLowerCase().indexOf(".jpeg")!=-1 || ipfsfilename.toLowerCase().indexOf(".jpg")!=-1)
            res.set('Content-Type', 'image/jpeg');
        if(ipfsfilename.toLowerCase().indexOf(".pdf")!=-1)
            res.set('Content-Type', 'application/pdf');
        let content=[]
        for await (let chunk of ipfs.cat(ipfsaddress)) {
            for (const item of chunk) {
                content.push(item); 
            }
        }
        let buf= new Buffer.from(content);
        res.send(buf);    
    }
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
// function to transfer asset
async function transferAsset(req,res,api){
        // get variable from the form
        let sessiontoken=req.cookies['sessiontoken'];
        let assetid=req.body.assetid;
        let destinationAccountTransfer=req.body.destinationAccountTransfer;
        let passwordTransfer=req.body.passwordTransfer;
        // clean previous cookies
        res.clearCookie('transferAssetError');
        res.clearCookie('viewAsset');
        //decrypt security seed from sessiontoken and compute keys and address
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
        const addressAccountOrigin=`${loggeduser.address}`;
        // check for password validity
        if(await verify_password_validity(username,passwordTransfer)==false){
            res.cookie("transferAssetError","Password is not valid");
            res.cookie('viewAsset', encodeURI(assetid));
            res.cookie('destinationAccountTransfer', encodeURI(destinationAccountTransfer));
            console.log("[info] transferAsset() - Password is not valid");
            res.redirect("/");
            return;
        }
        //check for destination account validity:
        if(verifyAccountValidity(destinationAccountTransfer)==false){
            res.cookie("transferAssetError","Destination Account is not valid");
            res.cookie('viewAsset', encodeURI(assetid));
            res.cookie('destinationAccountTransfer', encodeURI(destinationAccountTransfer));
            console.log("[info] transferAsset() - Destination Account is not valid");
            res.redirect("/");
            return;
        }
        //check for approval
        connection= await connect_database();
        let sqlquery= "SELECT * FROM assets WHERE id=?";
        await connection.query(
            {sql: sqlquery,
            values: [assetid]},
            async function (error, results, fields) {
            if (error) throw error;
            if(results.length==0){
                res.cookie("transferAssetError","Asset Id has not been found");
                res.cookie('viewAsset', encodeURI(assetid));
                res.cookie('destinationAccountTransfer', encodeURI(destinationAccountTransfer));
                console.log("[info] transferAsset() -Asset Id has not been found");
                res.redirect("/");
                return;
            }
            if(results[0].dtapproval==null){
                res.cookie("transferAssetError","Asset has not yet been approved. Transfer is not possible.");
                res.cookie('viewAsset', encodeURI(assetid));
                res.cookie('destinationAccountTransfer', encodeURI(destinationAccountTransfer));
                console.log("[info] transferAsset() - Asset has not yet been approved. Transfer is not possible.");
                res.redirect("/");
                return;
            }
            //check validity of asset id (ownership)
            if(results[0].accountowner!=addressAccountOrigin){
                res.cookie("transferAssetError","Asset does not belong to the logged user");
                res.cookie('viewAsset', encodeURI(assetid));
                res.cookie('destinationAccountTransfer', encodeURI(destinationAccountTransfer));
                console.log("[info] transferAsset() - Asset does not belong to the logged user");
                res.redirect("/");
                return;
            }
            write_log(`[info] Transferring Asset - S/N: ${results[0].serialnumber} - Request has been queued`,sessiontoken);
            console.log(`[info] Transferring Asset - S/N: ${results[0].serialnumber} - Request has been queued`);
            // build asset data
            let idstr=`${results[0].id}`;
            let buf = Buffer.from(idstr);
            let idb64 = buf.toString('base64');
            buf = Buffer.from(results[0].serialnumber);
            let serialnumberb64 = buf.toString('base64');
            buf = Buffer.from(results[0].description);
            let descriptionb64 = buf.toString('base64');
            buf = Buffer.from(results[0].ipfsphotoaddress);
            let ipfsphotoaddressb64 = buf.toString('base64');
            buf = Buffer.from(results[0].ipfsphotofilename);
            let ipfsphotofilenameb64 = buf.toString('base64');
            buf = Buffer.from(results[0].accountowner);
            let accountownerb64 = buf.toString('base64');
            buf = Buffer.from(results[0].accountapprover);
            let accountapproverb64 = buf.toString('base64');
            buf = Buffer.from(results[0].transactionid);
            let transactionidb64 = buf.toString('base64');
            buf = Buffer.from(results[0].dttransaction);
            let dttransactionb64 = buf.toString('base64');
            buf = Buffer.from(results[0].dtapproval);
            let dtapprovalb64 = buf.toString('base64');
            buf = Buffer.from(results[0].metadata);
            let metadatab64 = buf.toString('base64');
            let assetdata='{"operation":"transfer","id","'+idb64+'","serialnumber":"'+serialnumberb64+'",description"'+descriptionb64+'",';
            assetdata=assetdata+'"ipfsphotoaddress":"'+ipfsphotoaddressb64+'","ipfsphotofilename""'+ipfsphotofilenameb64+'",';
            assetdata=assetdata+'"metadata":"'+metadatab64+'",';
            assetdata=assetdata+'"accountowner":"'+accountownerb64+'","accountapprover":"'+accountapproverb64+'","transactionid":"'+transactionidb64+'",';
            assetdata=assetdata+'"dttransaction":"'+dttransactionb64+'","dtapproval":"'+dtapprovalb64+'"';
            assetdata=assetdata+'"destinationaccount":"'+destinationAccountTransfer+'"}';
            res.redirect('/');
            //write blockchain for transfer
            const unsub = await api.tx.wivSupplyChain.transferAsset(assetdata).signAndSend(loggeduser,(result) => {
                if (result.status.isInBlock) {
                    console.log(`[info] Transferring Asset - Transaction included at blockHash ${result.status.asInBlock}`);
                    write_log(`[info] Transferring Asset - Transaction included at blockHash ${result.status.asInBlock}`,sessiontoken);
                } else if (result.status.isFinalized) {
                    console.log(`[info] Transferred Asset - Transaction finalized at blockHash ${result.status.asFinalized}`);
                    write_log(`[info] Transferred Asset - Transaction finalized at blockHash ${result.status.asFinalized}`,sessiontoken);
                    //store assets in database
                    transfer_asset_db(results,destinationAccountTransfer,`${result.status.asFinalized}`);
                    unsub();
                }
            });
        });
        connection.end();  
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
    // building blockchaindata
    let buf = Buffer.from(body.assetSerialNumber);
    let serialnumberb64 = buf.toString('base64');
    buf = Buffer.from(body.assetDescription);
    let descriptionb64 = buf.toString('base64');
    buf = Buffer.from(ipfsname);
    let ipfsphotoaddressb64 = buf.toString('base64');
    buf = Buffer.from(originalfilename);
    let ipfsphotofilenameb64 = buf.toString('base64');
    buf = Buffer.from(`${loggeduser.address}`);
    let accountownerb64 = buf.toString('base64');
    let assetdata='{"operation":"asset","serialnumber":"'+serialnumberb64+'",description"'+descriptionb64+'",';
    assetdata=assetdata+'"ipfsphotoaddress":"'+ipfsphotoaddressb64+'","ipfsphotofilename""'+ipfsphotofilenameb64+'",';
    assetdata=assetdata+'"accountowner":"'+accountownerb64+'"}';        
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
    console.log("[info] - Writing log to "+filename+" ["+d+"]");
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
// function to transfer an asset in the assets table
async function transfer_asset_db(results,destinationaccount,transactionid){
    connection= await connect_database();
    let sqlquery= "INSERT INTO wivsupplychain.assets set serialnumber=?,description=?,ipfsphotoaddress=?,ipfsphotofilename=?,accountowner=?,transactionid=?,dttransaction=now(),dtapproval=?,accountapprover=?";
    connection.query(
        {sql: sqlquery,
        values: [results[0].serialnumber,results[0].description,results[0].ipfsphotoaddress,results[0].ipfsphotofilename,destinationaccount,transactionid,results[0].dtapproval,results[0].accountapprover]},
        function (error, results, fields) {
        if (error) throw error;
    });
    let sqlqueryu= "UPDATE wivsupplychain.assets set transfertransactionid=?,dttransfertransaction=now() where id=?";
    connection.query(
        {sql: sqlqueryu,
        values: [transactionid,results[0].id]},
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
    let sqlquery= "SELECT * FROM assets WHERE accountowner=? and transfertransactionid='' order by id desc";
    await connection.query(
        {sql: sqlquery,
        values: [accountid]},
        function (error, results, fields) {
        if (error) throw error;
        for (i = 0; i < results.length; i++) { 
            al=al+"<tr><td>"+results[i].id+"</td>";
            al=al+"<td>"+results[i].serialnumber+"</td>";
            al=al+'<td><a href="/viewasset?assetid='+results[i].id+'">'+results[i].description+"</a></td>";
            let dtt=`${results[i].dttransaction}`
            al=al+"<td>"+dtt.substr(0,15)+"</td>";
            let dtc=`${results[i].dtapproval}`
            if(dtc=="null"){
                dtc="Pending"
            }
            al=al+"<td>"+dtc.substr(0,15)+"</td>";
            al=al+"</tr>"
        }
        al=al+"</table>";
        res.send(al);
    });     
    connection.end();  
}
// async function to generate the asset details
async function viewAssetDetails(req,res){
    let connection= await connect_database(); 
    let ad='<table class="table table-hover" border="1">';
    if(req.query.assetid>0){
            let sqlqueryad= "SELECT * FROM assets WHERE id=?";
            connection.query(
            {
                sql: sqlqueryad,
                values: [req.query.assetid]
            },
            function (error, results, fields) {
                if (error){ throw error;}
                let uid=0;
                if (results.length > 0) {
                    ad = ad + "<tr><td>Unique ID</td><td>" + results[0].id + "</td></tr>";
                    uid=results[0].id;
                    ad = ad + "<tr><td>Serial Number<td>" + results[0].serialnumber + "</td></tr>";
                    ad = ad + "<tr><td>Description</td><td>" + results[0].description + "</td></tr>";
                    ad = ad + '<tr><td>Photo</td><td><img src="/photoasset?ipfsphotoaddress='+encodeURI(results[0].ipfsphotoaddress)+'&ipfsphotofilename='+encodeURI(results[0].ipfsphotofilename)+'" class="img-fluid"></td</tr>';
                    let dttr = `${results[0].dttransaction}`;
                    ad = ad + "<tr><td>Date Creation</td><td>" + dttr + "</td></tr>";
                    ad = ad + "<tr><td>Transaction id</td><td>" + results[0].transactionid + "</td></tr>";
                    let dta = `${results[0].dtapproval}`;
                    if (dta == "null") {
                        dta = "Pending";
                    }
                    ad = ad + "<tr><td>Date Approval</td><td>" + dta + "</td></tr>";
                    
                }
                ad = ad + "</table>";
                ad = ad + '<input type="hidden" name="assetid" value="'+uid+'">'
                res.clearCookie('viewAsset');
                res.send(ad);
            });           
    }else{
        res.send("");            
    }
    connection.end();
}
async function verify_password_validity(username,password){
    const fs = require('fs');
    let filename="./"+PATHKEYS+"/"+username+".enc";
    if (!fs.existsSync(filename) ) {
        console.log("[error] verify_password_validity() - username was not found (file.enc not found)")
        return(false);
    }
    else{
        // read once+encrypted seed from local storage
        data=fs.readFileSync(filename, 'utf8');
        if (data==null) {
                console.log("[error] verify_password_validity() - username was not found")
                return(false);
            }
        let b = data.split('###');
        let nonceb64=b[0];
        let encseedb64=b[1];
        //calculate the sha256 of received password
        const hash = crypto.createHash('sha256');
        hash.on('readable', () => {
            const data = hash.read();
            if (data) {
                console.log("[info] password hash: "+data.toString('hex'));
            }
        });
        hash.write(password);
        hash.end();
        let secret=hash.digest();
        //decode from base64 to 
        const nonce = Buffer.from(nonceb64,'base64');
        const encseed = Buffer.from(encseedb64,'base64');
        const securityseedarray = naclDecrypt(encseed, nonce, secret);
        if (securityseedarray==null){
            console.log("[error] verify_password_validity() - password is wrong")
            return(false);
        }
        return(true);
    }    
}
function verifyAccountValidity(address){
    try {
      encodeAddress(isHex(address)?hexToU8a(address):decodeAddress(address));
      return true;
    } catch (error) {
      return false;
    }
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
