'use strict';

const env = process.argv[2];
const conf = require('../conf/' + env);

const elasticsearch = require('elasticsearch');
const elastic = new elasticsearch.Client({
  host: conf.elasticsearch_host
  //, log: 'trace'
});

var params = {
  name: 'dw',
  //timeout: '10m',
  body: {
    template: 'dw-*',
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0
    },
    mappings: {
      doc: {
        properties: {
          timestamp: { type: 'date', format: 'strict_date_optional_time' },
          system : { type : 'keyword' },
          system_ip : { type : 'keyword' },
          facility_name : { type : 'keyword' },
          serverity : { type : 'keyword' },
          program: { type : 'keyword' },
          host: { type: 'keyword' },
          message: { type : 'text' },

          type: { type: 'keyword' },
          method: { type: 'keyword' },
          format: { type: 'keyword' },
          controller: { type: 'keyword' },
          action: { type: 'keyword' },
          status: { type: 'keyword' },
          duration: { type: 'float' },
          view: { type: 'float' },
          db: { type: 'float' },
          op_type: { type: 'keyword' },
          rows_sec: { type: 'integer' },
          time_sec: { type: 'float' }
        }
      }
    }
  }
};


elastic.indices.putTemplate(params, (err, res) => {
  if (err)
    console.log(err);
  else
    console.log(res);
});

process.on('uncaughtException', (err) => {
  console.log(err);
});