require('dotenv-safe').load();

var request = require('request');
var Botkit = require('botkit');
var controller = Botkit.slackbot();
var bot = controller.spawn({
	token: process.env.SLACK_TOKEN
})

bot.startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});


controller.hears(['playing','song is this'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/queue', function (error, response, body) {
		
		if (!error && response.statusCode == 200) {

	  	 	var rawResponseJSON = JSON.parse( body );
			
			if (rawResponseJSON.queue.length == 0 ) {
				bot.reply(message,'Nothing is currently playing.');
			} else {

				var track = rawResponseJSON.queue[0];
				var trackName = '"' + track.name + '" by ' + track.artists[0].name;
				bot.reply(message,trackName);
			}

		} else {
			bot.reply(message,'Shoot. For some reason, I couldn\'t figure out what is playing.');
		}
	});
});

controller.hears(['stop','pause','play'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/pause', function (error, response, body) {
		bot.reply(message,'Done.');
	});
});

controller.hears(['skip'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request('http://passthrough-reiling.rhcloud.com/api/skip', function (error, response, body) {
		bot.reply(message,'Cool. I didn\'t like that one, either.');
		
	});
});

controller.hears(['down'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/volume/-10', function (error, response, body) {
		bot.reply(message,'Kicked it down a little.');
	});
});

controller.hears(['up'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/volume/+10', function (error, response, body) {
		bot.reply(message,'Bumped up.');
	});
});

controller.hears(['help','what do you do'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/volume/+10', function (error, response, body) {
		bot.reply(message,'You can use me to FIND OUT WHAT\'S PLAYING, PAUSE, PLAY, SKIP or turn the VOLUME UP or DOWN. And hopefully soon I\'ll be able to search for music,too.');
	});
});

