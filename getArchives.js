'use strict';

const key = require('./conf/key.js');
const archives_path = key.archives;
const request = require('request');
const fs = require('fs');

const daysAgo = 450;
const daysUntil = 420;
const hours = 24;

var requests = [];

var options = {
	uri: 'https://papertrailapp.com/api/v1/archives/',
	method: 'GET',
  headers: { 'X-Papertrail-Token': key.token }
};

for (var i=daysAgo; i>daysUntil; i--) {
  var d = new Date();
  d.setDate(d.getDate() - i);
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

  for (var j=0; j<hours; j++) {
    var gte = new Date(d.getTime());
    gte.setHours(gte.getHours() + j);

    var req = JSON.parse(JSON.stringify(options));

    var mon = gte.getMonth() + 1;
    if (mon < 10)
      mon = '0' + mon;

    var day = gte.getDate();
    if (day < 10)
      day = '0' + day;

    var hr = gte.getHours();
    if (hr < 10)
      hr = '0' + hr;

    req.uri = req.uri + [gte.getFullYear(), mon, day, hr].join('-') + '/download';
    console.log(req.uri);
    requests.push(req);
  }
}

function sendRequest(req) {
  var file = archives_path + req.uri.split('/')[6] + '.tsv.gz';

  request.get(req)
    .on('error', (err) => {
      console.log('request error\n\n' + file + '\n\n');
      console.log(err);
      console.log('retrying...' + '\n\n');
      setTimeout(sendRequest, 10000, req);
    })
    .pipe(fs.createWriteStream(file))
    .on('finish', () => {
      console.log(file + ' - downloaded');
      
      if (requests.length)
        sendRequest(requests.shift());
      else
        console.log('done');
    });
}

sendRequest(requests.shift());