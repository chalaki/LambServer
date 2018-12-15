const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express()

const apiKey = '*****************';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')

app.get('/', function (req, res) {
    res.render('index', { worker_log: null, worker_output: null, error: null });
})

app.post('/', function (req, res) {
    let code = req.body.code;
    const fs = require('fs');
    fs.writeFile("./data/index.js", code, function (err) {
        if (err) return console.log(err);
        console.log("The file was saved!");
    });

    var docker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
    var docker_name = 'nodeworker' + docker_ext_port;
    const { exec } = require('child_process');
    exec('docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + docker_ext_port + ':8081/tcp  sundarigari/nodeimage:version3', (err, stdout, stderr) => {
        if (err) console.log(`error executing command`);
        console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
        exec('docker cp  ./data/. ' + docker_name + ':/', (err, stdout, stderr) => {
            if (err) console.log(`error executing command`);
            console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
            exec('docker exec -d ' + docker_name + ' bash server.sh', (err, stdout, stderr) => {
                if (err) console.log(`error executing command`);
                console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);

                let url = 'http://192.168.99.100:' + docker_ext_port + '/';
                const request = require('request');
                request(url, function (err, response, body) {
                    if (err) {
                        res.render('index', { weather: null, error: 'Error, please try again' });
                    } else {
                        // let weather = JSON.parse(body)
                        // if (weather.main == undefined) {
                        //     res.render('index', { weather: null, error: 'Error, please try again' });
                        // } else {
                        let weatherText = body;//`It's ${weather.main.temp} degrees in ${weather.name}!`;
                        console.log(body);
                        // }
                    }
                    var logfile = './workerlogs/' + docker_name + '.log';
                    exec('docker cp ' + docker_name + ':/worker.log  ' + logfile, (err, stdout, stderr) => {
                        const fs = require('fs');
                        fs.readFile(logfile, "utf8", function (err, data) {
                            if (err) throw err;
                            console.log(data);
                            res.render('index', { worker_output: body, worker_log: data, error: null });
                        });

                        exec('docker stop ' + docker_name, (err, stdout, stderr) => {
                            if (err) console.log(`error executing command`);
                            console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
                            exec('docker rm ' + docker_name, (err, stdout, stderr) => {
                                if (err) console.log(`error executing command`);
                                console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
                            });
                        });
                    });
                });

            });
        });
    });
})

app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
})