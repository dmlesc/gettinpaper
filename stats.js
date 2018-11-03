'use strict';

const conf = require('./conf/' + process.argv[2]);

const elasticsearch = require('elasticsearch');
const elastic = new elasticsearch.Client({
  host: conf.elasticsearch_host
  //, log: 'trace'
});

var params = {
  index: '_all'
};

elastic.indices.stats(params, (err, res) => {
  if (err)
    console.log(err);
  else {
    //console.log(res);
    var totalIndices = 0;
    var totalDocCount = 0;
    var totalBytesSize = 0;

    var totalIndexIndices = 0;
    var totalIndexLogs = 0;
    var totalIndexSize = 0;

    var indices = [];

    Object.keys(res.indices).forEach( (index) => {
      var stats = res.indices[index].total;
      var docCount = stats.docs.count;
      var bytes = stats.store.size_in_bytes;

      totalIndices++;
      totalDocCount += docCount;
      totalBytesSize += bytes
    });

    console.log('totalIndices: ', totalIndices);
    console.log('totalDocCount: ', totalDocCount);
    console.log('totalBytesSize: ', totalBytesSize);
    console.log('');
  }
});

process.on('uncaughtException', (err) => {
  console.log(err);
});
