var http = require('http');
var index = require('./index');
var startTime;
var port = 81;


var fs = require('fs');
var worker_env = JSON.parse(fs.readFileSync('./worker.config', 'utf8'));
var verbose = false;

var handleRequest = function (request, response) {

    response.setHeader('Content-Type', 'text/plain');
    response.writeHead(200);
    //console.log("handleRequest called ... \r\n");
    const fs = require('fs');
    fs.writeFileSync('./worker.log', '');

    if (request.method == 'POST') {
        //console.log("POST\r\n");
        var startTime = new Date().getTime();
        if (verbose) console.log("web App POST starting At: ", new Date().toString());
        var body = '';
        request.on('data', function (data) {
            body += data;
            // Too much POST data, kill the connection! 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) request.connection.destroy();
        });

        request.on('end', function () {
            var event = JSON.parse(body);
            var resultPromise = index.handler(event);
            var resp;
            resultPromise.then(function (result) {
                if (verbose) console.log("index.handler success\r\n");
                var stopTime = new Date().getTime();
                var elapsedTime = (stopTime - startTime) / 1000.0;
                result.elapsedWorkerTime = elapsedTime;

                resp = JSON.stringify(result);

                if (result.body) response.write(result.body);
                else response.write(resp);
                response.end();
                if (verbose) console.log("web App POST ending At:", new Date().toString() + ' elapsed: ' + elapsedTime);
            }, function (err) {
                console.error("index.handler() failure\r\n");
                console.error(err);
                resp = JSON.stringify(err);
                response.write(resp);
                response.end();
            })
        });
    }
    else {
        //console.log("GET\r\n");
        need = 'getsurveys';
        event = { queryStringParameters: { need: need, surveyId: 814412, supplierId: 1, supplierName: 'Mallesh', surveyName: 'Sattva', sdate: '2018-11-04', edate: '2018-11-08' } };
        var resultPromise = index.handler(event);
        var resp;
        resultPromise.then(function (result) {
            resp = JSON.stringify(result);
            if (result.body) response.write(result.body);
            else response.write(resp);
            response.end();
            //console.log("web App GET ending At:", endTime);
        }, function (err) {
            resp = JSON.stringify(err);
            if (verbose) console.log("index.handler() failure\r\n");
            response.write(resp);
            response.end();
        })
    }
}
var www = http.createServer(handleRequest);
www.listen(port, async function () {
    startTime = new Date().toLocaleString();
    var redis = require('redis');
    var redis_port = 6379;
    var redis_dns = '192.168.99.100';
    var worker_dns = redis_dns;

    if (verbose) console.log("******************* Worker Started At:", startTime, " Port: ", port, JSON.stringify(worker_env));
});