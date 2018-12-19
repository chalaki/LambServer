const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');

const app = express()
const docker_image = 'sundarigari/node';
var indexfile = "./docker/index.js";

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')

app.get('/', function (req, res) { res.render('index', { worker_log: null, worker_output: null, error: null }); })

app.post('/', function (req, res) {

    var docker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
    var docker_name = 'nodeworker' + docker_ext_port;
    var logfile = './workerlogs/' + docker_name + '.log';
    var docker_build_cmd = 'docker build -t ' + docker_image + ' ./docker';
    var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + docker_ext_port + ':8081/tcp  ' + docker_image;
    var docker_copy_cmd = 'docker cp ' + docker_name + ':/worker.log  ' + logfile;
    var docker_stop_cmd = 'docker stop ' + docker_name;
    var docker_rm_cmd = 'docker rm ' + docker_name;
    let url = 'http://192.168.99.102:' + docker_ext_port + '/';

    fs.writeFile(indexfile, req.body.code, function (err) {

        if (err) return console.log(err);
        console.log(indexfile + " saved.");

        console.log(docker_build_cmd);
        exec(docker_build_cmd, (err, stdout, stderr) => {  // build image from files in ./docker folder

            if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
            console.log(docker_run_cmd);
            exec(docker_run_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                const request = require('request');
                request.post({ url: url, body: req.body.event }, function (err, response, body) {

                    console.log(body);
                    console.log(docker_copy_cmd);
                    exec(docker_copy_cmd, (err, stdout, stderr) => {

                        if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                        const fs = require('fs');
                        fs.readFile(logfile, "utf8", function (err, data) {

                            console.log(data);
                            if (err) res.render('index', { worker_output: url + err, worker_log: url + err, error: url + ' Error calling POST on worker' });
                            else res.render('index', { worker_output: body, worker_log: data, error: null });
                            console.log(docker_stop_cmd);
                            exec(docker_stop_cmd, (err, stdout, stderr) => {

                                if (err) console.log(`error executing command`);
                                if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                                console.log(docker_rm_cmd);
                                exec(docker_rm_cmd, (err, stdout, stderr) => {

                                    if (err) console.log(`error executing command`);
                                    if (`${stdout}` != "") console.log(`${stdout}`); if (`${stderr}` != "") console.log(`${stderr}`);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
})

app.listen(80, function () { console.log('Chalaki serverless listening on port 80 go to http://localhost:80') })