// Web server for Supply Chain User Interface (run ny node index.js and connect by browsing to http://localhost:3000)
console.log("100 - Web Server for Supply Chain - ver. 1.00 - Starting");
let express = require('express');
const { ApiPromise, WsProvider } = require('@polkadot/api');   
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const { Keyring } = require('@polkadot/api');
const multer = require('multer');
const { mainModule } = require('process');
const { naclDecrypt,naclEncrypt,randomAsU8a,cryptoWaitReady, mnemonicGenerate} = require('@polkadot/util-crypto'); 
//const { keyring }= require('@polkadot/ui-keyring');
const { u8aToHex,stringToU8a,u8aToString } =require('@polkadot/util');
const crypto = require('crypto');
const cookieParser = require('cookie-parser')
const PATHKEYS="wivkeys";   //path where to store the encrypted login data
const PATHLOGS="wivlogs";   //path where to store logs for each user
const SECRET="4191ecdd49b1dc6b03020c2ea44a79e276c69f30"; //change it for your installation, it's used to encrypt the sessiontoken
let SECRETSHA256='';  //global var for SH256 computing

// execute main loop as async function
mainloop();

async function mainloop(){
    let fs = require('fs');
    const api = await ApiPromise.create({ provider: wsProvider });      // create API object
    let app = express();
    const upload = multer({
        dest: 'uploads/' // this saves your file into a directory called "uploads"
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
    let SECRETSHA256=hashSECRET.digest();
    //inizialize Wasm engine for polkadot-keyring-ui
    /*cryptoWaitReady().then(() => {
        // load all available addresses and accounts
        keyring.loadAll({ ss58Format: 42, type: 'sr25519' });
        console.log("Keyring loaded");
    });*/
    //creato folder for logs storage
    if (!fs.existsSync("./"+PATHLOGS)) {
        fs.mkdir("./"+PATHLOGS, function(err) {
            if (err) {
                console.log(err)
            } else {
                console.log("120 - New directory "+PATHLOGS+" successfully created.")
            }
        });
    }
    //routing for the web paths
    //main dashboard loaded from index.html
    app.get('/',function(req,res){             
        let v=read_file("index.html");
        res.send(v);
    });
    // new asset submission
    app.post('/addasset', upload.single('inputMainPhoto'), (req, res) => {
        console.log(req.body);
        console.log(req.file);
        console.log(req.file.originalname);
        console.log(req.file.path);
        let sessiontoken=req.cookies['sessiontoken'];
        console.log(req);
        store_asset(req.file.path,req.body,api,sessiontoken);
        res.redirect("/");
    });
    //login
    app.post('/login',function(req, res) {
        const fs = require('fs')

        console.log(req.body.userName);
        console.log(req.body.passwordLogin);
        let filename="./"+PATHKEYS+"/"+req.body.userName+".enc";
        console.log("filename:"+filename);
        if (!fs.existsSync(filename)) {
            res.redirect("/");
        }
        else{
            // read once+encrypted seed from local storage
            fs.readFile(filename, 'utf8' , (err, data) => {
                if (err) {
                    console.error(err);
                    return;
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
                    //todo write log error
                    
                }
                else{
                    // set cookie and write log for sucessfully login
                    // make a token with encrypted username and security seed (random nonce every time)
                    const securityseed=String.fromCharCode.apply(0, securityseedarray)
                    // make sha256 of the system password
                    const hash = crypto.createHash('sha256');
                    hash.on('readable', () => {
                        const data = hash.read();
                        if (data) {
                        console.log("hash: "+data.toString('hex'));
                        }
                    });
                    hash.write(SECRET);
                    hash.end();
                    secretsession=hash.digest();
                    //encrypt security seed
                    const { encrypteds, nonces } = naclEncrypt(stringToU8a(securityseed), secretsession);
                    console.log("encrypteds: ",encrypteds);
                    let de = Buffer.from(encrypteds);
                    let encryptedb64 = de.toString('base64');
                    let n = Buffer.from(nonces);
                    let nonceb64 = n.toString('base64');
                    let ub = Buffer.from(req.body.userName);
                    let usernameb64 = ub.toString('base64');
                    let sessiontoken=usernameb64+"###"+nonceb64+"###"+encryptedb64;
                    console.log("session token:"+sessiontoken);
                    res.cookie('sessiontoken', encodeURI(sessiontoken));
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
        res.cookie('sessiontoken', '', { expires: new Date(Date.now())});
        res.redirect("/");    
    });
    //signup
    app.post('/signup',function(req, res) {
        const fs = require("fs")
        console.log(req.body);
        console.log(req.body.userNameSignup);
        console.log(req.body.securitySeed);
        console.log(req.body.passwordSignup);
        let filename="./"+PATHKEYS+"/"+req.body.userNameSignup+".enc";
        const keyring = new Keyring({ type: 'sr25519' });
        const keyspair = keyring.addFromUri(req.body.securitySeed,{ name: req.body.userNameSignup });
        console.log(`102 - ${keyspair.meta.name}: has address ${keyspair.address} with publicKey [${keyspair.publicKey}]`);
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
        const { encrypted, nonce } = naclEncrypt(stringToU8a(req.body.securitySeed), secret);
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
        let logh='<table class="table table-striped"><tr><th>Date/Time</th><th>Event Description</th><tr>';
        let logf='</table>'
        if(sessiontoken==undefined){
            res.send(logh+logf);
        }else{
            let b = sessiontoken.split('###');
            let username=Buffer.from(b[0],'base64');
            let filename='./'+PATHLOGS+'/'+username+".log";
            //let logh='<div class="row"><div class="col-sm"><h3>Date/Time<h3></div><div class="col-sm"><h3>Event Description</h3></div></div>\n';
            let logh='<table class="table table-striped"><tr><th>Date/Time</th><th>Event Description</th><tr>';
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
// function to store assed in ipfs + blockchain
async function store_asset(filename,body,api,sessiontoken){
    const IpfsHttpClient = require('ipfs-http-client');
    const { globSource } = IpfsHttpClient;
    const ipfs = IpfsHttpClient();
    //const file = await ipfs.add(globSource(filename));
    //console.log(file);
    console.log("storing in blockchain:"+body.assetDescription);
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
    console.log("sessiontoken: "+sessiontoken);
    console.log("sessiontokendecoded: "+sessiontokendecoded);
    let b = sessiontokendecoded.split('###');
    let usernameb64=b[0];
    console.log("usernameb64 "+usernameb64);
    let nonceb64=b[1];
    console.log("nonceb64 "+nonceb64);
    let encseedb64=b[2];
    console.log("encseedb64 "+encseedb64);
    const username = Buffer.from(usernameb64,'base64');
    console.log("username:"+username);
    const nonce = Buffer.from(nonceb64,'base64');
    console.log("nonce:"+nonce);
    const encseed = Buffer.from(encseedb64,'base64');
    console.log("encseed:"+encseed);

    const securityseed = naclDecrypt(encseed, nonce, SECRETSHA256);
    console.log("securityseed:"+securityseed)
    const keyring = new Keyring({ type: 'sr25519' });
    //const PHRASE = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice';
    //const loggeduser = keyring.addFromUri(PHRASE,{ name: 'Alice' });
    const loggeduser = keyring.addFromUri(securityseed,{ name: username });
    let assetdata=body.assetDescription;
    const unsub = await api.tx.wivSupplyChain.newAsset(assetdata).signAndSend(loggeduser,(result) => {
        console.log(`Adding Asset - Current status is ${result.status}`);
        write_log(`[info] Adding Asset - Current status is ${result.status}`,sessiontoken);
        if (result.status.isInBlock) {
            console.log(`Adding Asset - Transaction included at blockHash ${result.status.asInBlock}`);
            write_log(`[info] Adding Asset - Transaction included at blockHash ${result.status.asInBlock}`,sessiontoken);
          } else if (result.status.isFinalized) {
            console.log(`Adding Asset - Transaction finalized at blockHash ${result.status.asFinalized}`);
            write_log(`[info] Adding Asset - Transaction finalized at blockHash ${result.status.asFinalized}`,sessiontoken);
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
