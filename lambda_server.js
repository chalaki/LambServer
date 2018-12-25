const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { execSync } = require('child_process');
const fs = require('fs');
const redis = require('redis');
const redis_port = 6379;
const redis_dns = '192.168.99.100';
const worker_dns = redis_dns;
const worker_int_port = 81;

var userid = 'sund';
var worker_platform = 'node';
var function_name = 'myfunc';
var docker_image;// = 'sundarigari/node.11-alpine.pg:v2'; //userid + '/' + worker_platform + function_name; //  node:11-alpine with pg for worker image

var worker_folder;
var worker_template_folder;
var indexfile;
var redis_key;

var docker_name;
var uenv;
var worker_ext_port;

const redis_client = redis.createClient(redis_port, redis_dns);
// redis_client.on('error', function (err) {
//     console.log('Something went wrong with redis ', err)
// });
// redis_client.set('mykey', JSON.stringify({ v: 'redis', j: 'working' }));

// redis_client.get('mykey', function (error, result) {
//     if (error) throw error;
//     console.log('mykey', JSON.parse(result));
// });

worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
indexfile = worker_folder + 'index.js';


const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')
var startTime = new Date().getTime();

app.get('/', function (req, res) {
    var origindexfilecont = fs.existsSync(indexfile) ? fs.readFileSync(indexfile, 'utf8') : '';
    res.render('index', {
        userid: userid, worker_platform: worker_platform, function_name: function_name,
        worker_code: origindexfilecont, worker_log: null, worker_output: null, error: null,
        worker_event: null
    });
})
//todo  worker folder may not exist

app.post('/', function (request, response) {

    startTime = new Date().getTime();
    console.log("########################################### app.post at: ", new Date().toString());
    userid = request.body.userid;
    worker_platform = request.body.worker_platform;
    function_name = request.body.function_name;

    var origindexfilecont = fs.existsSync(indexfile) ? fs.readFileSync(indexfile, 'utf8') : '';

    worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    worker_template_folder = './worker/' + worker_platform + '/template/';
    indexfile = worker_folder + 'index.js';
    redis_key = userid + worker_platform + function_name;

    redis_client.get(redis_key, function (error, result) {
        if (error || !result) {
            worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
            docker_name = userid + worker_platform + function_name + worker_ext_port;
            redis_client.set(redis_key, JSON.stringify({ docker_name: docker_name, docker_ext_port: worker_ext_port }), redis.print);
        }
        else {
            uenv = JSON.parse(result);
            docker_name = uenv.docker_name;
            worker_ext_port = uenv.docker_ext_port;
        }

        var cmd_stop_prev_container;
        var cmd_rm_prev_container;
        var func_changed = origindexfilecont.trim() != request.body.code.trim();
        var docker_running = false;

        try {
            execSync("docker inspect -f '{{.State.Running}}' " + docker_name);
            docker_running = true;
        }
        catch {
            console.log(docker_name + " worker container not running");
            docker_running = false;
        }

        if (func_changed || !docker_running) {
            var old_comspec = process.env.comspec;
            if (process.platform === 'win32') process.env.comspec = 'bash';
            // set config 

            var config = { userid: userid, worker_platform: worker_platform, function_name: function_name };

            execSync('echo \'' + JSON.stringify(config) + '\' > ' + worker_template_folder + 'worker.config');
            try {
                execSync('mkdir ./worker/' + worker_platform + '/' + userid);
                execSync('mkdir ' + worker_folder);
            }
            catch  { }
            execSync('cp -r ' + worker_template_folder + '*  ' + worker_folder);
            process.env.comspec = old_comspec;

            fs.writeFileSync(indexfile, request.body.code);
            console.log(indexfile + " saved.");

            // build run new image
            var prev_docker_name = docker_name;
            var prev_docker_image = prev_docker_name + "_img";

            worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
            docker_name = userid + worker_platform + function_name + worker_ext_port;
            docker_image = docker_name + "_img";

            var docker_build_cmd = 'docker build -t ' + docker_image + ' ' + worker_folder;
            var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + worker_ext_port + ':' + worker_int_port.toString() + '/tcp  ' + docker_image;

            redis_client.set(redis_key, JSON.stringify({ docker_name: docker_name, docker_ext_port: worker_ext_port }), redis.print);
            console.log(docker_build_cmd);
            execSync(docker_build_cmd);
            exec(docker_build_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                console.log(docker_run_cmd);
                exec(docker_run_cmd, (err, stdout, stderr) => {
                    if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                    setTimeout(() => { postAndRender(request, response, prev_docker_name, prev_docker_image) }, 1000);
                });
            });
        }
        else postAndRender(request, response, null, null);
    })
});

function postAndRender(req, res, prevdock, prevdocimage) {
    const request = require('request');
    let url = 'http://' + worker_dns + ':' + worker_ext_port + '/';
    console.log('##### postAndRender url:' + url);
    request.post({ url: url, body: req.body.event }, function (err, response2, body) {
        var local_worker_logfile = './workerlogs/' + docker_name + '.log';
        var docker_copy_logfile_cmd = 'docker cp ' + docker_name + ':/worker.log  ' + local_worker_logfile;

        console.log('########## postAndRender POST to worker returned body: ' + body);
        console.log('########## ' + docker_copy_logfile_cmd);
        exec(docker_copy_logfile_cmd, (err, stdout, stderr) => {
            //console.log('############### after copy log ' + body);
            if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
            const fs = require('fs');
            fs.readFile(local_worker_logfile, "utf8", function (err, data) {
                //console.log('#################### logfile: ' + data);
                if (err) res.render('index', { userid: userid, worker_platform: worker_platform, function_name: function_name, worker_code: req.body.code, worker_event: req.body.event, worker_output: url + err, worker_log: url + err, error: url + ' Error calling POST on worker' });
                else res.render('index', {
                    userid: userid, worker_event: JSON.stringify(JSON.parse(req.body.event), null, 2), worker_platform: worker_platform, function_name: function_name, worker_code: req.body.code,
                    worker_output: JSON.stringify(JSON.parse(body), null, 2), worker_log: data, error: null
                });
                var renderTime = new Date().getTime();
                console.log("#################### Rendered at: ", new Date().toString() + ' elapsed: ' + (renderTime - startTime) / 1000.0);
                if (prevdock) setTimeout(() => { dockerCleanup(prevdock, prevdocimage); }, 1000);
            });
        });
    });
}

function dockerCleanup(prevdocker, prevdocimage) {
    console.log('##### dockerCleanup (' + prevdocker + ')');
    cmd_stop_prev_container = 'docker stop ' + prevdocker;
    cmd_rm_prev_container = 'docker rm -rf ' + prevdocker;
    cmd_rmi_prev_image = 'docker rmi ' + prevdocimage;
    console.log('##### ' + cmd_stop_prev_container + '\n');
    exec(cmd_stop_prev_container, (err, stdout, stderr) => {
        if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
        console.log('########## ' + cmd_rm_prev_container + '\n');
        setTimeout(() => {
            exec(cmd_rm_prev_container, (err, stdout, stderr) => {
                if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                console.log('########## ' + cmd_rmi_prev_image + '\n');
                setTimeout(() => {
                    exec(cmd_rmi_prev_image, (err, stdout, stderr) => {
                        if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                        var afterCleanupTime = new Date().getTime();
                        console.log("############### Cleanup at: ", new Date().toString() + ' elapsed: ' + (afterCleanupTime - startTime) / 1000.0);
                    });
                }, 3000);
            }, 3000);
        });
    });
}
var port = 80;
if (process.argv.length > 2) port = process.argv[2];
app.listen(port, function () { console.log('Chalaki serverless listening on port 80 go to http://localhost:80') });