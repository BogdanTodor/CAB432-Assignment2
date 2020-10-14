const express = require('express');
const axios = require('axios');
const needle = require('needle');
const router = express.Router();
const Sentiment = require('sentiment');
const redis = require('async-redis');

/* API Keys (move to environment variable) */
const twitter = {
  bearer_token: 'AAAAAAAAAAAAAAAAAAAAAH7SGwEAAAAAMerg5B1I%2FC48tDU6b5qC8xHcS%2BY%3DBAvtWfRzXTSlv7qGgPVZTvg8s8VxtUqt1BWOMEFpGjFVghF30D'
};
streamConnect()

/* Routes */
// GET home page
router.get('/', async (req, res) => {
  const redisClient = redis.createClient();
  let rules = [];
  let keys = [];
  let tweets = [];

  let labelArray = []; // empty
  let negArray = []; // empty
  let neutralArray = []; // empty
  let posArray = []; // empty

  let chartData = [
    labelArray,
    negArray,
    neutralArray,
    posArray
  ]


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
  for (let rule of rules) {
    let pattern = rule.value + '*';
    // console.log('Pattern: ' + pattern)
    let firstScanResult = await redisClient.scan('0', "MATCH", pattern);
    let cursor = firstScanResult[0];
    keys = keys.concat(firstScanResult[1]);
    // console.log('First scanResult: ' + JSON.stringify(firstScanResult));
    while (cursor > 0) {
      let scanResult = await redisClient.scan(cursor, "MATCH", pattern);
      cursor = scanResult[0];
      keys = keys.concat(scanResult[1]);
      // console.log('scanResult: ' + JSON.stringify(scanResult));
    }
  }
  console.log('Keys: ' + JSON.stringify(keys));

  for (let rule of rules){
    labelArray.push(rule.tag);
  }

  // Use Redis Keys to get Tweets Objects
  for (let redisKey of keys) {
    let cachedTweet = await redisClient.get(redisKey);
    tweets.push(JSON.parse(cachedTweet));
    let tweetObj = JSON.parse(cachedTweet);
    // console.log(tweetObj);

    if(tweetObj.score > 1){
      if(posArray[labelArray.indexOf(tweetObj.tag)] > 0){
        posArray[labelArray.indexOf(tweetObj.tag)]++;
      }
      else{
        posArray[labelArray.indexOf(tweetObj.tag)] = 1;
      }
    } 
    else if(tweetObj.score < 1){
      if(negArray[labelArray.indexOf(tweetObj.tag)] > 0){
        negArray[labelArray.indexOf(tweetObj.tag)]++;
      }
      else{
        negArray[labelArray.indexOf(tweetObj.tag)] = 1;
      }
    }
    else{
      if(neutralArray[labelArray.indexOf(tweetObj.tag)] > 0){
        neutralArray[labelArray.indexOf(tweetObj.tag)]++;
      }
      else{
        neutralArray[labelArray.indexOf(tweetObj.tag)] = 1;
      }
    }
  }
  // console.log('Tweets: ' + JSON.stringify(tweets));

  // For debugging purposes
  console.log(labelArray);
  console.log(chartData);
  console.log(JSON.stringify(chartData));

  res.render('index', {
    title: 'Welcome to Twitter Sentiment Analysis',
    rules: rules,
    tweets: tweets,
    chartData: JSON.stringify(chartData)
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
  console.log('deleting: ' + old_rule);

  const twitter_token = getTwitterAuth();
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const data = {
    'delete': {
      'ids': [old_rule]
    }
  };
  const twitter_rsp = await postAPIRequest(twitter_url, data, twitter_token);
  console.log('Twitter Post Rsp: ' + JSON.stringify(twitter_rsp));

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

async function streamConnect() {
  //Listen to the stream
  const options = {
    timeout: 20000
  }

  const token = getTwitterAuth();
  const stream = needle.get('https://api.twitter.com/2/tweets/search/stream', token, options);
  const redisClient = redis.createClient();

  stream.on('data', async data => {
    try {
      const json = JSON.parse(data);
      // console.log("New Tweet: " + JSON.stringify(json));

      const redisKey = `${json.matching_rules[0].tag}:${json.data.id}`;
      // console.log(redisKey);

      // Check if tweet exists in Redis
      let cacheTweet = await redisClient.get(redisKey); //, (err, result) => {
      if (cacheTweet) {
        // console.log("Already in cache");
      } else {
        // console.log('Not in cache');
        // Get timestamp
        let timestamp = Math.floor(+new Date());
        // Run Sentiment Analysis
        const lowerJson = json.data.text.toLowerCase();
        let re = new RegExp("(?<=:).*")
        let userRemovedMsg = re.exec(String(lowerJson));
        let lessURL = String(userRemovedMsg).replace("http\S+", "");
        var sentiment = new Sentiment();
        var result = sentiment.analyze(lessURL);
        // Create Tweet Obj
        const dataObj = {
          tweetText: lessURL,
          tweetId: json.data.id,
          timestamp: timestamp,
          tag: json.matching_rules[0].tag,
          score: result.score,
          comparativeScore: result.comparative
        }
        // console.log('Formatted Tweet:' + JSON.stringify(dataObj));
        // Store in Redis
        let cacheJSON = Object.assign({}, dataObj);
        console.log('Storing in cache: ' + JSON.stringify(cacheJSON));
        redisClient.setex(redisKey, 360, JSON.stringify(cacheJSON));
        tweets.unshift(dataObj);
      }
      // });
    } catch (e) {
      // Keep alive signal received. Do nothing.
    }
  }).on('error', error => {
    if (error.code === 'ETIMEDOUT') {
      console.log('Stream Connection Timed Out');
      stream.emit('timeout');
      stream.abort();
      setTimeout(streamConnect(), 5000);
    }
  });

  return stream;
};



module.exports = router;