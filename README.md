# RingCentral Notification Add-in for Google Forms

[![Build Status](https://github.com/ringcentral/google-forms-notification-add-in/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ringcentral/google-forms-notification-add-in/actions)
[![Coverage Status](https://coveralls.io/repos/github/ringcentral/google-forms-notification-add-in/badge.svg?branch=main)](https://coveralls.io/github/ringcentral/google-forms-notification-add-in?branch=main)

[A RingCentral Add-in](https://www.ringcentral.com/apps/google-forms-add-in-for-ringcentral) to receive Google Forms response messages at RingCentral Team Messaging.

## Prerequisites

- Download and install RingCentral App and login: https://www.ringcentral.com/apps/rc-app
- Nodejs and npm
- Register an app on Google platform

## Development

### Step.1 Clone this project

```
$ git clone https://github.com/ringcentral/google-forms-notification-add-in.git
```

### Step.2 Install dependencies

Inside project root:

```
$ npm install
```

### Step.3 Start Ngrok Web Tunnel

```bash
# start proxy server, this will allow your local bot server to be accessed by the RingCentral service
$ npm run ngrok

# will show
# Forwarding                    https://xxxx.ngrok.io -> localhost:6066
# Remember the https://xxxx.ngrok.io, we will use it later
```

ngrok will expose your local server to a public address where you can have other services interact with it.

Note: your local firewall might block certain ngrok regions. If so, try changing `ngrok http -region us 6066` in `package.json` to [other regions](https://www.google.com/search?q=ngrok+regions).

### Step.4 Set Up Environment Info

```bash
$ cp .env.sample .env
```

Edit `.env` file as `.env.sample` to set environment variables. The `APP_SERVER` is publish uri that we get from ngrok. For `DATABASE_CONNECTION_URI`, we can just keep `sqlite://./db.sqlite`. We will use sqlite as local database. 
Get Google Client credentials from Google Developer Console. For `GOOGLE_PUBSUB_TOPIC_NAME`, please create Pub/Sub topic follow [here](https://developers.google.com/forms/api/guides/push-notifications#set_up_a_cloud_pubsub_topic).

### Step.5 Create A Notification Add-In App In RingCentral Developer Portal

Go to [RingCentral Developer Portal](https://developers.ringcentral.com/) and [create a notification add-in app](https://developers.ringcentral.com/guide/basics/create-app).

On app creation page, please:
- Tick on 'This app can be installed via web' and fill in `https://xxxx.ngrok.io/setup` 

### Step.6 Start Local Server and Client

Open 2 new terminals and run below commands respectively:

```bash
# open a new terminal
# start local server
npm run start

# open another new terminal
# start webpack server
npm run client
```

### Step.7 Try at RingCentral Sandbox

Go to `https://app.devtest.ringcentral.com/apps/sandbox` with your sandbox account, you can get your apps in development here. Click Plus icon to add the notification app to test.

# Deployment

## Deploy with Serverless

### 1. Compile JS files

```
$ npm run client-build
```

And get all JS assets file at public folder. Upload all files in public into CDN or static web server.

### 2. Create `serverless-deploy/env.yml` file

```
$ cp serverless-deploy/env.default.yml serverless-deploy/env.yml
```

Edit `serverless-deploy/env.yml` to set environment variables.
We will get `APP_SERVER` after first deploy. So now just keep it blank.

### 3. Create `serverless-deploy/serverless.yml` file

```
$ cp serverless-deploy/serverless.default.yml serverless-deploy/serverless.yml
```

Edit `serverless-deploy/env.yml` to update serverless settings.
The Dynamo `TableName` should be `${DYNAMODB_TABLE_PREFIX}users`. `DYNAMODB_TABLE_PREFIX` is environment variable that we set upper. `ASSETS_PATH` is uri where you host JS files in `Step 1`.

### 4. Deploy

```
$ npm run serverless-build
$ npm run serverless-deploy
```

In first deploy, you will get lambda uri in console output: `https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod`.
Copy the uri, and update environment variable `APP_SERVER` with it in `serverless-deploy/env.yml` file. Then deploy again:

```
$ npm run serverless-deploy
```
