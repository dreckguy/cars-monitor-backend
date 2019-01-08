function getFormattedDate() {
    var date = new Date();
    var str = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " +  date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds();

    return str;
}

function getSeconds() {
    var date = new Date();
    var str = date.getSeconds() + "." + date.getMilliseconds();

    return Number(str);
}

function getUniqueID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

function checkNewItems() {  
  s3.getObject(params, function(err, data) {    
    try {
      if (err) console.log(err, err.stack); // an error occurred
      else {        
        if (LatestObject == JSON.parse(data.Body.toString())) {
          console.log("No new items, continuing");
        }
        // Found new Timestamp -> Start pushing data
        else {      
          try {
            LatestObject = JSON.parse(data.Body.toString());      
            wss.clients.forEach(function each(client) {
              //console.log("CLIENT ID IS: " + client.id);
              console.log(play_list);
              // Check if the clientId is in the playlist
              if(play_list.indexOf(client.id) == -1 ){}
              else {                       
                  var json = JSON.stringify({ message: LatestObject });                
                  client.send(json); 
                  // console.log("SERVER TIME: " + getFormattedDate() + " TS TIME: " + LatestObject.Timestamp);             
              } 
            });
          }
          catch(err){
            console.log(err,err.message)
          }
        }        
      } 
    }
    // Handle errors
    catch (err) {
      // Socket is not defined
      if (err instanceof ReferenceError){console.log("WARNING: Socket is not defined.");}
      else {
        console.log(err); // an error occurred
        throw err.message;
      }
    }       
  });  
}

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

var s3 = new AWS.S3({apiVersion: '2012-08-10'});
var params = {
  Bucket: "elasticbeanstalk-eu-central-1-645717288378", 
  Key: "car"
};

// Set the region 
AWS.config.update({region: 'eu-central-1'});

var http = require('http');
var express = require('express');
var WSS = require('ws').Server;

var app = express().use(express.static('public'));
var server = http.createServer(app);
server.listen(8080, '172.31.35.178');
// server.listen(8080, 'localhost');

var time = new Date();

// Save the latest object received
var LatestObject = "";
var checkHandler;
var play_list = [];

var intervalHandler;
// Interval time for the S3 function
var intervalTime = 150;
var connections
// Set the interval for the S3 retreival function
intervalHandler = setInterval(checkNewItems, intervalTime);

// Open websocket connection
var wss = new WSS({ port: 8081 ,clientTracking: 'True', rejectUnauthorized: false, perMessageDeflate: false});
wss.on('connection', function connection(socket, req) {    

  console.log(req);
  // Set the client id
  socket.id = getUniqueID();
  if(play_list.indexOf(socket.id) == -1) {play_list.push(socket.id);}  
 
  // Received connection message
  socket.on('message', function incoming(message) {
    
    // Parse the received message
    var msg = JSON.parse(message);
    // Act based on the message    
    switch(msg.message) {
      case "pause":
        // Check if the clientId is in the playlist and remove it from the playlist if exists
        if(play_list.indexOf(socket.id) != -1) {play_list.splice(play_list.indexOf(socket.id),1);}        
        if(play_list.length == 0){
          clearInterval(intervalHandler);
        }
        break;
      case "play" || "connect":  
        // Check if the clientId is in the playlist and insert it to the playlist if exists
        if(play_list.length == 0) {intervalHandler = setInterval(checkNewItems, intervalTime);}
        if(play_list.indexOf(socket.id) == -1) {play_list.push(socket.id);}
        // checkHandler = setInterval(checkNewItems, 100);
        break;

    }
    console.log("RECEIVED MESSAGE: " + msg.message);      
  });

  // Closed connection
  socket.on('close', function(socket) {     
    let clientList = [];
    let ind = -1;
    wss.clients.forEach(function each(client) {
      clientList.push(client.id)
    });
    for(let i in play_list){
      ind = clientList.indexOf(play_list[i])
      if(ind == -1){
        console.log("Removing socket id " + play_list[i]);
        play_list.splice(i,1);
      }
    }    
  });
});
