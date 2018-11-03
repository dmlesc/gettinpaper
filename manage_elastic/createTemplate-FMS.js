'use strict';

const env = process.argv[2];
const conf = require('../conf/' + env);

const elasticsearch = require('elasticsearch');
const elastic = new elasticsearch.Client({
  host: conf.elasticsearch_host
  //, log: 'trace'
});

var params = {
  name: 'fms',
  //timeout: '10m',
  body: {
    template: 'fms-*',
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
          
          op_type: { type: 'keyword' },
          status: { type: 'keyword' },
          client_address: { type: 'keyword' },
          user_agent: { type: 'text' },
          client_id: { type: 'text' }
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