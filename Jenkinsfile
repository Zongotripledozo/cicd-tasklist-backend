pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        APP_IMAGE_NAME = 'cicd-tasklist-backend'
        APP_IMAGE_TAG = "${env.BUILD_NUMBER}"
        LOCAL_IMAGE_NAME = "${APP_IMAGE_NAME}:${APP_IMAGE_TAG}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                sh 'npm run prisma:generate'
            }
        }

        stage('Unit Tests') {
            steps {
                sh 'npm run test:coverage'
            }

            post {
                always {
                    junit 'reports/junit.xml'
                }
            }
        }

        stage('E2E Tests') {
            steps {
                sh 'npm run test:e2e:coverage'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    withSonarQubeEnv('sonarqube-local') {
                        sh '''
                            npx sonar-scanner \
                                -Dsonar.token=$SONAR_TOKEN \
                                -Dsonar.host.url=$SONAR_HOST_URL
                        '''
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker Image') {
            steps {
                sh 'docker build -t "$LOCAL_IMAGE_NAME" .'
            }
        }

        stage('Trivy Scan') {
            steps {
                sh 'trivy image --timeout 20m --severity HIGH,CRITICAL --exit-code 1 "$LOCAL_IMAGE_NAME"'
            }
        }

        stage('Generate SBOM') {
            steps {
                sh 'trivy image --timeout 20m --format spdx-json -o sbom-spdx.json "$LOCAL_IMAGE_NAME"'
            }
        }

        stage('Push Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                    sh '''
                        REMOTE_IMAGE_NAME="docker.io/$DOCKERHUB_USER/$APP_IMAGE_NAME:$APP_IMAGE_TAG"
                        echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin
                        docker tag "$LOCAL_IMAGE_NAME" "$REMOTE_IMAGE_NAME"
                        docker push "$REMOTE_IMAGE_NAME"
                    '''
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'sbom-spdx.json', allowEmptyArchive: true, fingerprint: true
            cleanWs()
        }
    }
}