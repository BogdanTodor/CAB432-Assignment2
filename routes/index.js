const express = require('express');
const axios = require('axios');
const router = express.Router();
const Sentiment = require('sentiment');
const redis = require('async-redis');
const AWS = require('aws-sdk');

// Set region for AWS
AWS.config.update({region: 'ap-southeast-2'});

// Create DynamoDB service object
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

// Create Redis Client
const redisClient = redis.createClient({host:'n9767126-twitter-sentiment.km2jzi.ng.0001.apse2.cache.amazonaws.com', port: 6379});
// const redisClient = redis.createClient();

/* API Keys (move to environment variable) */
const twitter = {
  bearer_token: 'AAAAAAAAAAAAAAAAAAAAAH7SGwEAAAAAMerg5B1I%2FC48tDU6b5qC8xHcS%2BY%3DBAvtWfRzXTSlv7qGgPVZTvg8s8VxtUqt1BWOMEFpGjFVghF30D'
};

/* Routes */
// GET home page
router.get('/', async (req, res) => {
  let rules = [];
  let keys = [];
  let tweets = [];
  let labelArray = [];
  let historical_data = [];

  // Get Active Twitter Rules
  const twitter_token = getTwitterAuth();
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const twitter_rsp = await getAPIResponse(twitter_url, twitter_token);
  if (twitter_rsp.data) {
    twitter_rsp.data.forEach(function (rule) {
      rules.push(rule);
    });
  }

  // Get Redis Keys for Tweets with tags matching the Active Rules
  let i = 0;
  for (let rule of rules) {
    let pattern = rule.value + '*';
    let firstScanResult = await redisClient.scan('0', "MATCH", pattern);
    let cursor = firstScanResult[0];
    keys = keys.concat(firstScanResult[1]);
    while (cursor > 0) {
      let scanResult = await redisClient.scan(cursor, "MATCH", pattern);
      cursor = scanResult[0];
      keys = keys.concat(scanResult[1]);
    }
    labelArray.push(rule.tag);
    historical_data[i++] = new Array();
  }
  // console.log('Label Array: ' + JSON.stringify(labelArray));

  // DynamoDB pull data
  // console.log('\nHistorical Data before: ' + JSON.stringify(historical_data));
  for(let tweetTag of labelArray){
    var params = {
      TableName: 'TwitterSentimentAnalysis',
      Key: {
        'TAG': {S: tweetTag}
      }
    };
    const data = await ddb.getItem(params).promise();
    if(Object.keys(data).length != 0){
      let historicalSessionData = data.Item.HISTORICAL_DATA.S;
      historical_data.splice(labelArray.indexOf(tweetTag), 1, JSON.parse(historicalSessionData));
    }
  }
  // console.log("\nHistorical Data after: " + JSON.stringify(historical_data));

  // Create Arrays to store categorised sentiment scores
  let negArray = new Array(rules.length).fill(0);
  let neutralArray = new Array(rules.length).fill(0);
  let posArray = new Array(rules.length).fill(0);

  // Create Arrays to get average score for each rule
  let sumScores = new Array(rules.length).fill(0);
  let totalTweets = new Array(rules.length).fill(0);
  let avgScore = new Array(rules.length).fill(0);

  // Use Redis Keys to get Tweets Objects
  for (let redisKey of keys) {
    let cachedTweet = await redisClient.get(redisKey);
    tweetObj = JSON.parse(cachedTweet);
    // If tweet was deleted from cache continue to next iteration
    if (!tweetObj) {
      continue;
    }
    // Perform Sentiment Analysis 
    const lowerJson = tweetObj.tweetText.toLowerCase();
    let re = new RegExp("(?<=:).*")
    let userRemovedMsg = re.exec(String(lowerJson));
    let lessURL = String(userRemovedMsg).replace("http\S+", "");
    var sentiment = new Sentiment();
    var result = sentiment.analyze(lessURL);

    // Attach scores to tweet
    tweetObj.score = result.score;
    tweetObj.comparativeScore = result.comparative;
    tweets.push(tweetObj);

    // Do operations to get categorised sentiment and average sentiment 
    totalTweets[labelArray.indexOf(tweetObj.tag)]++;
    sumScores[labelArray.indexOf(tweetObj.tag)] += tweetObj.score;
    if(tweetObj.score > 1){
      posArray[labelArray.indexOf(tweetObj.tag)]++;
    } 
    else if(tweetObj.score < -1){
      negArray[labelArray.indexOf(tweetObj.tag)]++;
    }
    else{
      neutralArray[labelArray.indexOf(tweetObj.tag)]++;
    }
  }

  // Calculate average sentiment scoree for each tweet
  for(let i = 0; i < sumScores.length; i++){
    if(totalTweets[i] > 0){
      avgScore[i] = sumScores[i]/totalTweets[i];
    }
    else{
      avgScore[i] = 0;
    }
  }

  // Get session score for each tag and append to data pulled from DynamoDB
  let sessionTimeStamp = Math.floor(+new Date());
  for(let tag of labelArray){
    let lineDataObj = {
      "timestamp": sessionTimeStamp,
      "score": avgScore[labelArray.indexOf(tag)]
    };
    historical_data[labelArray.indexOf(tag)].push(lineDataObj);
  }
  // console.log("\nHistorical Data to be pushed: " + JSON.stringify(historical_data));

  // Insert data into DynamoDB
  for(let tag of labelArray){
    var params = {
      TableName: 'TwitterSentimentAnalysis',
      Item: {
        'TAG' : {S: tag},
        'HISTORICAL_DATA' : {S: JSON.stringify(historical_data[labelArray.indexOf(tag)])}
      }
    };
    ddb.putItem(params, function(err, data) {
      if (err) {
        // console.log("Error", err);
      } else {
        // console.log("Success", data);
      }
    });
  }

  // Create required Chart data to send to frontend Javascript
  let chartData = [
    labelArray,
    negArray,
    neutralArray,
    posArray
  ];

  let overlappingTimestamps;
  // Get overlapping timestamps
  if (Object.keys(rules).length != 0) {
    overlappingTimestamps = historical_data[0].map(e => e.timestamp);
    // console.log('\n timestampArray: ' + JSON.stringify(overlappingTimestamps));

    for (let i = 1; i < labelArray.length ; i++) {
      // Get array of timestamps
      let timestampArray = historical_data[i].map(e => e.timestamp);
      // console.log('\n timestampArray: ' + JSON.stringify(timestampArray));
  
      // Get overlapping timestamps
      overlappingTimestamps = overlappingTimestamps.filter(element => timestampArray.includes(element));
    }
    // console.log('\n overlappingTimestamps: ' + JSON.stringify(overlappingTimestamps));
  
    for (let i = 0; i < labelArray.length ; i++) {
      historical_data[i] = historical_data[i].filter(element => overlappingTimestamps.includes(element.timestamp));
      historical_data[i] = historical_data[i].map(e => e.score);
    }
  }
  // console.log('\n historical_data used for graphs: ' + JSON.stringify(historical_data));

  let lineGraphData = [
    labelArray,
    overlappingTimestamps,
    historical_data
  ]

  res.render('index', {
    title: 'Twitter Sentiment Analysis Dashboard',
    rules: rules,
    tweets: tweets,
    barChartData: chartData,
    lineGraphData: lineGraphData
  });
});

router.post('/', async (req, res) => {
  res.redirect('/');
});

// POST new rule to twitter stream
router.post('/add-rule/', async (req, res) => {
  let new_rule = req.body.q;

  const twitter_token = getTwitterAuth();
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const data = {
    'add': [{
      "value": new_rule,
      "tag": new_rule
    }]
  };
  const twitter_rsp = await postAPIRequest(twitter_url, data, twitter_token);
  // console.log('Twitter Post Rsp: ' + JSON.stringify(twitter_rsp));
  
  res.redirect('/');
});

// POST delete rule from twitter stream
router.post('/delete-rule/', async (req, res) => {
  let old_rule = req.body.delete;
  // console.log('deleting: ' + old_rule);

  const twitter_token = getTwitterAuth();
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const data = {
    'delete': {
      'ids': [old_rule]
    }
  };
  const twitter_rsp = await postAPIRequest(twitter_url, data, twitter_token);
  // console.log('Twitter Post Rsp: ' + JSON.stringify(twitter_rsp));

  res.redirect('/');
});

/* Helper Functions */
function getTwitterAuth() {
  return {
    headers: {
      'Content-type': 'application/json',
      'Authorization': 'Bearer ' + twitter.bearer_token
    }
  };
}

function createTwitterRulesOptions() {
  const options = {
    hostname: 'api.twitter.com',
    path: '/2/tweets/search/stream/rules'
  }
  return options;
}

async function getAPIResponse(url, config_token) {
  try {
    const response = await axios.get(url, config_token);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}

async function postAPIRequest(url, data, config_token) {
  try {
    const response = await axios.post(url, data, config_token);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}

module.exports = router;