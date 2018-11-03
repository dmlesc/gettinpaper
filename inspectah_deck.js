'use strict';

process.on('uncaughtException', (err) => { console.log(err); });

const conf = require('./conf/' + process.argv[2]);
const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const properties = require('properties-parser');
const elasticsearch = require('elasticsearch');

const elastic = new elasticsearch.Client({
  host: conf.elasticsearch_host
  //, log: 'trace'
});


//const archives = conf.archives;
const archives = process.argv[3];
const inflated = conf.inflated;
const processed = conf.processed;

var date;
var gzFile, inflatedFile;

var logs = [];
var howmany = 5000;


var total_processed = 0;


var files = fs.readdirSync(archives);
console.log(files);


function startProcess(file) { 
  console.log('start processing: ' + file);

  date = file.split('-').slice(0, 3).join('-');
  inflateFile(file);
}

function inflateFile(file) {
  gzFile = archives + file;
  inflatedFile = gzFile.replace('.gz', '');
  inflatedFile = inflatedFile.replace(archives, inflated);

  fs.readFile(gzFile, (err, data) => {
    if (err) 
      console.log(err);
    else {
      zlib.gunzip(data, (err, result) => {
        if (err) 
          console.log(err);
        else {
          fs.writeFileSync(inflatedFile, result);
          console.log('inflated: ' + inflatedFile);

          loadFile(inflatedFile);
        }
      });
    }
  });
}

function loadFile(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  rl.on('line', (line) => { logs.push(line); });
  rl.on('close', () => {
    console.log('loaded: ' + file);
    console.log('parsing: ' + file);

    total_processed += logs.length;
    console.log('#logs:', logs.length, 'total:', total_processed);

    parseLogs(logs.splice(0, howmany));
  });
}

function parseLogs(logs) {
  var bulk = [];

  for (var i=0; i < logs.length; i++) {
    //process.stdout.write(i + ' / ' + logs.length + '     \r');

    var line = logs[i].split('\t');
    var doc = {};

    var timestamp = line[2];
    var system = line[4];
    var system_ip = line[5];
    var facility_name = line[6];
    var severity = line[7];
    var program = line[8];
    var message = line[9];

    if (system.startsWith('DW-')) {
      if (program.startsWith('RailsAppServer')) {
        if (message.startsWith('[pid: ')) {
          var text = message.split(']')[1].trim().replace(/\ /g, '\n');
          var obj = properties.parse(text);
          //console.log(obj);

          if (obj.method !== 'undefined') {
            doc.method = obj.method;
            doc.path = obj.path;
            doc.format = obj.format;
            doc.controller = obj.controller;
            doc.action = obj.action;
            doc.status = obj.status;
            doc.duration = obj.duration;
            doc.view = obj.view;
            doc.db = obj.db;

            doc.type = 'request';
            doc.message = 'condensed';
          }
          else {
            doc.type = 'unprocessed';
            doc.message = message;
          }
        }
        else {
          //console.log(message.substring(0, 150));
          doc.type = 'unprocessed';
          doc.message = message;
        }
      }
      else if (program.startsWith('Sidekiq')) {
        //console.log(program, message.substring(0, 150));

        if (message.includes('rows/sec')) {
          var message_split = message.split(' ');
          var operation = message_split[1].slice(0, -1);
          var rows_sec = Math.round(message_split[2]);

          if (operation == 'average')
            operation = 'processing_avg';
          
          doc.type = 'db_stats';
          doc.op_type = operation;
          doc.rows_sec = rows_sec;
          doc.message = 'condensed';
        }
        else if (message.startsWith('ETL: ')) {
          if (message.includes('[Total time: ')) {
            doc.time_sec = message.split('[Total time: ')[1].slice(0, -5);
          }

          doc.type = 'ETL';
          doc.message = message;
        }
        else if (message.includes('done: ')) {
          var message_split = message.split(' ');
          doc.type = message_split[3];
          doc.time_sec = message_split[7];
        }
        else {
          doc.type = 'unprocessed';
        }

      }
      else if (program.startsWith('Reports')) {
        if (message.includes('done: ')) {
          var message_split = message.split(' ');
          doc.type = message_split[3];
          doc.time_sec = message_split[7];
        }
        else {
          doc.type = 'unprocessed';
        }
      }
      else {
        //console.log(program, message.substring(0, 150));
        doc.type = 'unprocessed';
      }
    }
    else if (system.startsWith('TTM-')) {
      if (program.startsWith('RailsAppServer')) {
        if (message.startsWith('[pid: ')) {
          if (message.includes('method=')) {
            var text = message.split(']')[1].trim().replace(/\ /g, '\n');
            var obj = properties.parse(text);
            //console.log(obj);

            doc.method = obj.method;
            doc.path = obj.path;
            doc.format = obj.format;
            doc.controller = obj.controller;
            doc.action = obj.action;
            doc.status = obj.status;
  
            if (obj.client_address) {
              obj.client_address = obj.client_address.slice(0, -1);;
            }

            if (obj.error) {
              doc.error = message.split(' error=')[1];
            }
            else {
              doc.duration = obj.duration;
              doc.db = obj.db;
  
              if (obj.view)
                doc.view = obj.view;
            }

            doc.type = 'request';
            doc.message = 'condensed';
          }
          else if (message.includes('(clever)')) {
            doc.type = 'clever';
            doc.message = message;
          }
          else if (message.includes('CSRF')) {
            doc.type = 'CSRF';
            doc.message = message;
          }
          else if (message.includes('unicorn')) {
            doc.type = 'unicorn';
            doc.message = message;
          }
          else if (message.includes('newrelic')) {
            doc.type = 'newrelic';
            doc.message = message;
          }
          else if (message.includes('rack')) {
            doc.type = 'rack';
            doc.message = message;
          }
          else if (message.includes('** [Bugsnag] ')) {
            doc.type = 'Bugsnag';
            doc.message = message;
          }
          else if (message.includes(' (lti) ')) {
            doc.type = 'lti';
            doc.message = message;
          }
          else if (message.includes('MathJS Error')) {
            doc.type = 'MathJS_Error';
            doc.message = message;
          }
          else {
            //console.log(message.substring(0, 200));
            doc.type = 'unprocessed';
            doc.message = message;
          }          
        }
        else {
          //console.log(message.substring(0, 225));
          doc.type = 'unprocessed';
          doc.message = message;
        }          
      }
      else if (program.startsWith('Sidekiq')) {
        if (message.startsWith('Assigning ')) {
          doc.type = 'assign';
          doc.op_type = message.split(' ')[1].slice(1, -1);
          doc.message = 'condensed';
        }
        else if (message.startsWith('Create ')) {
          doc.type = 'create';
          doc.op_type = message.split(' ')[1].slice(1, -1);
          doc.message = 'condensed';
        }
        else if (message.startsWith('Update ')) {
          doc.type = 'update';
          doc.op_type = message.split(' ')[1].slice(1, -1);
          doc.message = 'condensed';
        }
        else if (message.startsWith('Adding ')) {
          doc.type = 'add';
          doc.op_type = message.split(' ')[1].slice(1, -1);
          doc.message = 'condensed';
        }
        else if (message.startsWith('Downloading ')) {
          doc.type = 'download';
          doc.message = message;
        }
        else if (message.startsWith('Performing ActionMailer')) {
          doc.type = 'performing_mailer';
          doc.op_type = message.split('"')[1];
          doc.message = message;
        }
        else if (message.startsWith('Performed ActionMailer')) {
          doc.type = 'performed_mailer';
          doc.time_ms = message.split(' ')[5].replace('ms', '');
          doc.message = message;
        }
        else if (message.startsWith('Sent mail to')) {
          doc.type = 'sent_mail';
          doc.time_ms = message.split(' ')[4].slice(1, -3);
          doc.message = 'condensed';
        }
        else if (message.startsWith('Scoped ')) {
          doc.type = 'scoped';
          doc.message = message;
        }
        else {
          //console.log(message.substring(0, 225));
          doc.type = 'unprocessed';
          doc.message = message;
        }          
      }
      else if (program.startsWith('Reports')) {
        if (message.startsWith('Fetching ')) {
          doc.type = 'fetch';
          doc.op_type = message.split(' ')[1];
          doc.message = message;
        }
        else if (message.startsWith('Posting adhoc')) {
          doc.type = 'adhoc_report';
          doc.message = message;
        }
        else if (message.startsWith('ERROR')) {
          doc.type = 'error';
          doc.message = message;
        }
        else if (message.includes('** [Bugsnag] ')) {
          doc.type = 'Bugsnag';
          doc.message = message;
        }
        else {
          doc.type = 'unprocessed';
          doc.message = message;
        }
      }
      else {
        //console.log(program, message.substring(0, 225));
        doc.type = 'unprocessed';
        doc.message = message;
      }          
    }
    else if (system.startsWith('LT-')) {
      if (message.startsWith('info FAYE:')) {
        var op = message.split(':')[1].trim();

        if (op == 'Client Subscribed')
          doc.op_type = 'subscribed';
        else if (op == 'New Client Connected')
          doc.op_type = 'connected';
        else if (op == 'New Client Unsubscribed')
          doc.op_type = 'unsubscribed';
        else
          doc.op_type = 'unknown';

        doc.type = 'FAYE';
        doc.message = message;
      }
      else if (message.startsWith('info ')) {
        doc.type = 'info';
        doc.message = message;
      }
      else if (message.startsWith('warn ')) {
        doc.type = 'warn';
        doc.message = message;
      }
      else if (message.startsWith('error ')) {
        doc.type = 'error';
        doc.message = message;
      }
      else {
        //console.log(message.substring(0, 225));
        doc.type = 'unprocessed';
      }
    }
    else if (system.startsWith('FMS')) {
      //console.log(message.substring(0, 225));
      
      doc.type = 'FMS';
      var msg = message.split('|')[1].split('\\t');
      
      doc.op_type = msg[0];
      doc.status = msg[15];
      doc.client_address = msg[16];
      doc.user_agent = msg[22];
      doc.client_id = msg[23];
      doc.message = 'condensed';
      
      /*
      console.log(msg[0]);
      console.log('  ', msg[39]);

      if (msg[0].includes('Fields'))
        console.log('===================================================');
      */
    }

    else {
      //console.log(system, program, message.substring(0, 150));
      doc.type = 'unprocessed';
      doc.message = message;
    }

    doc.timestamp = timestamp;
    doc.system = system;
    doc.system_ip = system_ip;
    doc.facility_name = facility_name;
    doc.severity = severity;

    var program_split = program.split('-');
    doc.program = program_split[0];
    if (program_split[1]) {
      doc.host = program_split[1];
    }
  
    var action = {};
    var index = {};

    index._index = system.toLowerCase() + '-' + date;
    //index._type = system.split('-')[0].toLowerCase();
    index._type = 'doc';
    action.index = index;
    bulk.push(action);
    bulk.push(doc);
  }

  elasticBulk(bulk);
}

function elasticBulk(bulk) {
  elastic.bulk({ body: bulk }, (err, res) => {
    if (err) {
      console.log(err);
    }
    else {
      //console.log(res);
      //console.log(res.items[0].index);

      if (logs.length > 0) {
        parseLogs(logs.splice(0, howmany));
      }
      else {
        console.log('finished processing: ' + inflatedFile);
        cleanUp();
      }
    }
    process.stdout.write('remaining: ' + logs.length + '     \r');
  });
}


function cleanUp() {
  fs.unlinkSync(inflatedFile);
  fs.renameSync(gzFile, gzFile.replace(archives, processed));
  console.log('cleaned up: ' + gzFile);

  if (files.length)
    startProcess(files.shift());
  else {
    console.log('no more files to process');
  }
}


startProcess(files.shift());

