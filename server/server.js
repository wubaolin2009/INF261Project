var http = require('http');
var https = require('https');
var url = require("url");
var util = require("util");
var path = require('path');
var fs = require('fs');
var mongoose = require('mongoose');
function init_db() {
	mongoose.connect("mongodb://localhost/test");
}
init_db();

var certsPath = path.join(__dirname, 'certs', 'server');
var caCertsPath = path.join(__dirname, 'certs', 'ca');

//
// SSL Certificates
//
options = {
	key: fs.readFileSync(path.join(certsPath, 'my-server.key.pem'))
	, cert: fs.readFileSync(path.join(certsPath, 'my-server.crt.pem'))
	, requestCert: false
	, rejectUnauthorized: true
};


var User = mongoose.model('User',{email: String, publicKey:String});
var Email = mongoose.model('Email', {emailId:String, emailFrom:String, expired:String, encryptedData:String, subject:String, encryptedKeys:Array, del:String});

/* test cases... */
// create 2 user,
// get 2 users public key
// create a email
// assign user's key to this email
// assign other's key to this email
// get this email by user
// get this email by other user.
// Manually, lasy to write test case
/*
 http://52.25.168.169:8888/createUser?userEmail=useremail&userPublicKey=userpubkey
 http://52.25.168.169:8888/createUser?userEmail=otheremail&userPublicKey=otherpubkey

 http://52.25.168.169:8888/getUserPublicKeys?userNames=useremail,otheremail

 http://52.25.168.169:8888/createEmail?fromUser=useremail&emailId=emailid1&encryptedData=encryptedDataForEmail1

 http://52.25.168.169:8888/addCiphterKeyToEmail?emailId=emailid1&userName=useremail&encryptedKey=keyuser1
 http://52.25.168.169:8888/addCiphterKeyToEmail?emailId=emailid1&userName=otheremail&encryptedKey=keyuser2

 http://52.25.168.169:8888/getEmail?emailId=emailid1&userName=useremail
 http://52.25.168.169:8888/getEmail?emailId=emailid1&userName=otheremail

 */

function generateDefaultJSON() {
	var result = {success:false, msg:"Invalid Url"};
	return JSON.stringify(result,null, 4);
}
function onRequest(req, response) {
	response.writeHead(200, {'Content-Type': 'application/json',"Access-Control-Allow-Origin":"*"});
	// naive way to handle events
	var result = url.parse(req.url, true);
	if(result.pathname == "/createEmail") {
		fromUser, emailId, encryptedData
		var fromUser = result.query.fromUser;
		var emailId = result.query.emailId;
		var encryptedData = result.query.encryptedData;
		var subject = result.query.subject;
		var del = "false";
		var expired = result.query.expired;
		if(result.query.del) {
			del = result.query.del;
		}
		createEmail(fromUser, emailId, encryptedData, subject, del,expired, response);
	} else if(result.pathname == "/createUser") {
		var email = result.query.userEmail;
		var userPublicKey = result.query.userPublicKey;
		createUser(email, userPublicKey, response);
	} else if(result.pathname == "/getUserPublicKeys") {
		var userNames = result.query.userNames;
		// convert to string array
		userNames = userNames.split(",");
		getUsersPublicKeys(userNames, response);
	} else if(result.pathname == "/getEmail") {
		var emailId = result.query.emailId;
		var userName = result.query.userName;
		getEmail(emailId, userName, response);
	} else if(result.pathname == "/addCiphterKeyToEmail") {
		var email = result.query.emailId;
		var userName = result.query.userName;
		var encryptedKey = result.query.encryptedKey;
		addCiphterKeyToEmail(email, userName, encryptedKey, response);
	} else if(result.pathname == "/sendNeedAccessEmail") {
		var emailFrom = result.query.emailFrom;
		var emailTo = result.query.emailTo;
		var emailId = result.query.emailId;
		sendNeedAcessEmail(emailFrom, emailTo, emailId, response);
	}
	else {
		response.end(generateDefaultJSON());
	}
}

/* make https usable */
// https://github.com/coolaj86/nodejs-ssl-example/tree/master/bin
https.createServer(options,onRequest).listen(8888);

// 终端打印如下信息
console.log('Server running at http://127.0.0.1:8888/');

function createUser(userEmail, userPublicKey, response) {
	console.log("in create user userEmail: " + userEmail + " key:" + userPublicKey);
	var newUser = new User({email:userEmail, publicKey:userPublicKey});
	console.log("WBL key is: ", userPublicKey);
	newUser.save(function(err) {
		var result = {};
		if(err) {
			result.success = false;
		} else {
			result.success = true;
		}
		result.msg = 'createUser() ' + userEmail + " public key is created";
		response.end(JSON.stringify(result,null, 4));
	});
}
function getUsersPublicKeys(userNames, response) {
	User.find({email:{$in:userNames}}, function(err, objs){
		var result = {};
		result.keys = {};
		if(err) {
			result.succes = false;
			result.msg = err;
		} else {
			result.succes = true;
		}
		for(index in objs) {
			var user = objs[index];
			console.log("YLS getPublicKeys:" + user + " " + user.email + " " + user.publicKey);
			result.keys[user.email] = user.publicKey;
		}
		response.end(JSON.stringify(result,null, 4));
	});
}

function createEmail(fromUser, emailId, encryptedData, subject, del, expired, response) {
	console.log("in create Email from: " + fromUser + "EmailId:" + emailId + "data" + encryptedData);
	if(expired != "0") {
		var now = new Date().getTime();
		now += Number(expired) * 1000;
		expired = now.toString();
	}
	var newEmail = new Email({emailId:emailId, del:del, emailFrom:fromUser, expired:expired, encryptedData:encryptedData, subject:subject, encryptedKeys:[]});
	console.log("WBL email subject: "  + subject);
	newEmail.save(function(err) {
		var result = {};
		if(err) {
			result.success = false;
		} else {
			result.success = true;
		}
		result.msg = "createEmail() from:" + fromUser + "EmailId:" + emailId;
		response.end(JSON.stringify(result,null, 4));
	});
}

function addCiphterKeyToEmail(emailId, userName, encryptedKey, response) {
	Email.find({emailId:emailId}, function(err, objs){
		console.log("in addCiphterKeyToEmail: " + emailId + " userName:" + userName + " key:" + encryptedKey);
		var hasError = false;
		if(err) {
			hasError = true;
			console.log(err);
		}
		for(index in objs) {
			var email = objs[index];
			email.update({$push:{encryptedKeys:[userName,encryptedKey]}}, function(err) {});
		}
		var result = {};
		if(err) {
			result.success = false;
		} else {
			result.success = true;
		}
		for(index in objs) {
			var email = objs[index];
			result.success[email.emailId] = userName;
		}
		response.end(JSON.stringify(result,null, 4));
	});
}

function getEmail(emailId, userName, response) {
	// return encrypted key and encrypted content
	// var Email = mongoose.model('Email', {emailId:String, emailFrom:String, encryptedData:String, encryptedKeys:Array});
	Email.find({emailId:emailId}, function(err, objs){
		console.log(objs);
		var result = {};
		result.keys = {};
		if(err || objs.length != 1) {
			result.success = false;
		} else {
			result.succes = true;
		}
		result.deleted = 0;
		result.countEmail = objs.length;
		for(index in objs) {
			var email = objs[index];
			if(email.expired != "0") {
				var now = new Date().getTime();
				if(now > Number(email.expired)) {
					result.success = false;
					Email.remove({emailId:emailId}, function(err,objs){});
					continue;
				}
			}
			result.keys.email = email.emailId;
			result.keys.from = email.emailFrom;
			result.keys.data = email.encryptedData;
			result.keys.subject = email.subject;
			for(j in email.encryptedKeys) {
				var key = email.encryptedKeys[j];
				if(key[0] == userName) {
					result.keys.encKey = key[1];
					// for demo purpose, just delete it!
					if (email.del == "1") {
						Email.remove({emailId:emailId}, function(err,objs){});
					}
				}
			}
		}
		response.end(JSON.stringify(result,null, 4));
	});
}

var emailjs   = require("emailjs");
var emailServer  = emailjs.server.connect({
	user:    "inf261ucitestbaolin",
	password:"wubaolin1989",
	host:    "smtp.gmail.com",
	ssl:     true
});

function sendNeedAcessEmail(fromUser, toUser, emailId, response) {
	var emailText = "Hello, I am " + toUser + " and I want to have the access to this email: " + emailId;
	var htmllText = "<div>";
	htmllText += "<input type=\"hidden\" name=\"enc261\" value=\"\"/>";
	htmllText += "<input type=\"hidden\" name=\"enc261_funcName\" value=\""+ "grantAccess" + "\"/>";
	htmllText += "<input type=\"hidden\" name=\"enc261_emailId\" value=\""+emailId + "\"/>";
	htmllText += "<input type=\"hidden\" name=\"enc261_fromUser\" value=\""+fromUser + "\"/>";
	htmllText += "</div>";

	emailServer.send({
		text:    emailText,
		from:    "INF261ProjectServer <inf261ucitestbaolin@gmail.com>",
		to:      "DearUser<" + toUser +">",
		attachment: [{data:"<html>" + htmllText + "</html>", alternative:true}],
		subject: "Please grant " + fromUser + " the access to email id" + emailId
	}, function(err, message) { console.log(err || message);
		var result = {};
		result.succes = true;
		result.from = fromUser;
		result.to = toUser;
		result.emailId = emailId;
		response.end(JSON.stringify(result,null, 4));
	});
}

