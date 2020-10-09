var express = require('express');
const axios = require('axios');
var router = express.Router();

/* Routes */
// GET home page]
router.get('/', async(req, res) => {
  let rules = [];
  console.log('Rules: ' + JSON.stringify(rules));

  // Get Active Twitter Rules
  const twitter_token = getTwitterAuth();
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const twitter_rsp = await getAPIResponse(twitter_url, twitter_token);
  console.log('Twitter Rsp: ' + JSON.stringify(twitter_rsp));

  twitter_rsp.data.forEach(function (rule) {
    rules.push(rule);
  });

  res.render('index', { 
    title: 'Welcome to Twitter Sentiment Analysis',
    rules: rules
   });
});

// POST new rule to twitter stream
router.post('/add-rule/', async (req, res) => {
  let new_rule = req.body.q;

  const twitter_token = getTwitterAuth(new_rule);
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const data = {
    'add': [{"value": new_rule}]
  };
  const twitter_rsp = await postAPIRequest(twitter_url, data, twitter_token);
  // console.log('Twitter Post Rsp: ' + JSON.stringify(twitter_rsp));

  res.redirect('/');
});

// POST new rule to twitter stream
router.post('/delete-rule/', async (req, res) => {
  let old_rule = req.body.delete;
  console.log('deleting: ' + old_rule);

  const twitter_token = getTwitterAuth(old_rule);
  const twitter_options = createTwitterRulesOptions();
  const twitter_url = `https://${twitter_options.hostname}${twitter_options.path}`;
  const data = {
    'delete': {'ids' : [old_rule]}
  };
  const twitter_rsp = await postAPIRequest(twitter_url, data, twitter_token);
  console.log('Twitter Post Rsp: ' + JSON.stringify(twitter_rsp));

  res.redirect('/');
});

/* API Keys */
const twitter = {
  bearer_token : 'AAAAAAAAAAAAAAAAAAAAAH7SGwEAAAAAMerg5B1I%2FC48tDU6b5qC8xHcS%2BY%3DBAvtWfRzXTSlv7qGgPVZTvg8s8VxtUqt1BWOMEFpGjFVghF30D'
};

/* Helper Functions */
function getTwitterAuth() {
  return { 
      headers: {
          'Content-type': 'application/json',
          'Authorization': 'Bearer ' + twitter.bearer_token
      }
  };
}

function getTwitterAuth(rule) {
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
