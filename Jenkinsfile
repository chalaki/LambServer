pipeline {
    agent {
        docker {
            image 'node:11-alpine'
            //image 'sundarigari/node'
            args '-p 80:80 '
        }
    }
    environment { 
        CI = 'true'
    }
    stages {
        stage('Build') {
            steps {
                sh 'npm install'
                sh 'apk add docker'
                sh 'chmod 777 ./jenkins/scripts/test.sh'
                sh 'chmod 777 ./jenkins/scripts/deliver.sh'
                sh 'chmod 777 ./jenkins/scripts/kill.sh'
            }
        }
        // stage('Test') {
        //     steps {
        //         sh './jenkins/scripts/test.sh'
        //     }
        // }
        stage('Deliver') { 
            steps {
                sh './jenkins/scripts/deliver.sh' 
                input message: 'Finished using the web site? (Click "Proceed" to continue)' 
                sh './jenkins/scripts/kill.sh' 
            }
        }
    }
}