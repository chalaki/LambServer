const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { execSync } = require('child_process');
const fs = require('fs');

const app = express()


var userid = 'sund';
var worker_platform = 'node';
var function_name = 'myfunc';
const docker_image = 'sundarigari/node.11-alpine.pg:v2'; //userid + '/' + worker_platform + function_name; //  node:11-alpine with pg for worker image
var worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
var worker_template_folder = './worker/' + worker_platform + '/template/';
var indexfile = worker_folder + 'index.js';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')

var redis = require('redis');
var redis_port = 6379;
var redis_dns = '192.168.99.100';
var worker_dns = redis_dns;
var worker_int_port = 81;

var redis_client = redis.createClient(redis_port, redis_dns);
redis_client.on('error', function (err) {
    console.log('Something went wrong with redis ', err)
});
redis_client.set('mykey', JSON.stringify({ v: 'redis', j: 'working' }));

redis_client.get('mykey', function (error, result) {
    if (error) throw error;
    console.log('mykey', JSON.parse(result));
});


app.get('/', function (req, res) { res.render('index', { worker_code: null, worker_log: null, worker_output: null, error: null }); })

app.post('/', function (req, res) {

    var worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
    var docker_name;
    var uenv;
    var redis_key = userid + worker_platform + function_name;
    redis_client.get(redis_key, function (error, result) {
        if (error || !result) {
            docker_name = userid + worker_platform + function_name + worker_ext_port;
            redis_client.set(redis_key, JSON.stringify({ docker_name: docker_name, docker_ext_port: worker_ext_port }), redis.print);
        }
        else {
            uenv = JSON.parse(result);
            docker_name = uenv.docker_name;
            worker_ext_port = uenv.docker_ext_port;
        }

        var local_worker_logfile = './workerlogs/' + docker_name + '.log';
        //var docker_build_cmd = 'docker build -t ' + docker_image + ' ' + worker_folder;  // not needed
        var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + worker_ext_port + ':' + worker_int_port.toString() + '/tcp  ' + docker_image;
        var docker_copy_cmd = 'docker cp ' + docker_name + ':/worker.log  ' + local_worker_logfile;
        var docker_copyto_cmd = 'docker cp ' + indexfile + ' ' + docker_name + ':/index.js';
        var docker_worker_cmd = 'docker exec -d ' + docker_name + ' ash ./worker.sh';  // stops and stars node worker.js 
        var docker_stop_cmd = 'docker stop ' + docker_name;
        //var docker_rm_cmd = 'docker rm ' + docker_name;
        let url = 'http://' + worker_dns + ':' + worker_ext_port + '/';

        var origindexfilecont = '';

        // var comspec = process.env.comspec;
        // if (process.platform === 'win32') process.env.comspec = 'bash';
        // execSync('cp -r ' + worker_template_folder + '*  ' + worker_folder);
        // process.env.comspec = comspec;

        if (fs.existsSync(indexfile)) origindexfilecont = fs.readFileSync(indexfile, 'utf8');
        var func_changed = origindexfilecont != req.body.code;


        var docker_running = false;
        try {
            execSync("docker inspect -f '{{.State.Running}}' " + docker_name);
            docker_running = true;
        }
        catch {
            console.log(docker_name + " worker container not running");
            execSync(docker_run_cmd);
            docker_running = true;
        }

        if (func_changed) {
            fs.writeFileSync(indexfile, req.body.code);
            console.log(indexfile + " saved.");
            console.log(docker_copyto_cmd);
            execSync(docker_copyto_cmd);
        }

        console.log(docker_worker_cmd);
        execSync(docker_worker_cmd);


        //exec(docker_run_cmd, (err, stdout, stderr) => {

        //if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
        const request = require('request');
        request.post({ url: url, body: req.body.event }, function (err, response, body) {

            console.log(body);
            console.log(docker_copy_cmd);
            exec(docker_copy_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                const fs = require('fs');
                fs.readFile(local_worker_logfile, "utf8", function (err, data) {

                    console.log(data);
                    if (err) res.render('index', { worker_output: url + err, worker_log: url + err, error: url + ' Error calling POST on worker' });
                    else res.render('index', { worker_code: req.body.code, worker_output: body, worker_log: data, error: null });

                    // if (func_changed && docker_running) {
                    //     console.log(docker_stop_cmd);
                    //     execSync(docker_stop_cmd);//, (err, stdout, stderr) => {
                    //     //if (err) console.log(`error executing command`);
                    //     //if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                    //     console.log(docker_rm_cmd);
                    //     execSync(docker_rm_cmd);//, (err, stdout, stderr) => {
                    //     redis_client.set(redis_key, "", redis.print);
                    //     //if (err) console.log(`error executing command`);
                    //     //if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                    //     //});
                    //     //});
                    // }

                });
            });

            // if (func_changed && docker_running) {
            //     execSync(docker_stop_cmd);//, (err, stdout, stderr) => {
            //     //if (err) console.log(`error executing command`);
            //     //if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
            //     //console.log(docker_rm_cmd);
            //     //execSync(docker_rm_cmd);//, (err, stdout, stderr) => {

            //     //if (err) console.log(`error executing command`);
            //     //if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
            //     //});
            //     //});
            // }

        });
        //});
        //});
        //});
    })
});

app.listen(80, function () { console.log('Chalaki serverless listening on port 80 go to http://localhost:80') })