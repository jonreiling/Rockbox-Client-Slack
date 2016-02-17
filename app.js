if (!process.env.OPENSHIFT_NODEJS_PORT) {
	require('dotenv-safe').load();
}

var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);

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

controller.hears(['^(play|add) the album (.*) by (.*)$'],['direct_message','direct_mention','mention'],function(bot,message) {
	
	bot.reply(message,'Looking now... This may take a moment.');

	var albumName = simpleescape(message.match[2]);
	var artistName = simpleescape(message.match[3]);

	var requestURL = 'https://api.spotify.com/v1/search?q=album:%22' + albumName + '%22%20artist:%22'+artistName+'%22&type=album&limit=1&market=US';

  	request(requestURL, function (error, response, body) {

		if (!error && response.statusCode == 200) {
			
	  	 	var rawResponseJSON = JSON.parse( body );

			if (rawResponseJSON.albums.total == 0 ) {

				bot.reply(message,'Sorry, couldn\'t find it. Be sure to double check the spelling, though. I\'m kind of a stickler.');

			} else {


				var album = rawResponseJSON.albums.items[0];


			  	request("https://api.spotify.com/v1/albums/" + album.id, function (albumerror, albumresponse, albumbody) {

			  		var album = JSON.parse( albumbody );
					var albumYear = new Date(Date.parse(album.release_date))
			  		var albumName = '*"' + (album.name) + ' ('+albumYear.getFullYear()+')"* by _' + album.artists[0].name +'_' ;

					bot.startConversation(message,function(err,convo) {

					    convo.ask({
					    	"text":'To confirm, you wanted to play the entire album ' + albumName + ', correct? It\'s '+album.tracks.items.length+' tracks long.',
					    	"icon_url":album.images[2].url,
							"username":bot.identity.name
					    },[
					      {
					        pattern: bot.utterances.yes,
					        callback: function(response,convo) {
					          convo.say('Adding now...');
							  request(process.env.PASSTHROUGH_SERVER + '/api/add/' + album.uri, function (error, response, body) {
						          convo.say('Done. Coming right up.');
						          convo.next();
							  });

					        }
					      },
					      {
					        pattern: bot.utterances.no,
					        callback: function(response,convo) {
					          convo.say('Phew. Glad I asked.');
					          convo.next();
					        }
					      },
					      {
					        default: true,
					        callback: function(response,convo) {
					          convo.repeat();
					          convo.next();
					        }
					      }
					    ]);

					  })
				  	});

				  	/*


				var albumName = '*"' + (album.name) + '"*';

				  */
			}

		} else {
			bot.reply(message,'Shoot. For some reason, I couldn\'t make the request properly.');
		}  		

  	});

});


controller.hears(['^(play|add) (.*) by (.*)$'],['direct_message','direct_mention','mention'],function(bot,message) {
	

	bot.reply(message,'Searching now...');

	var songName = simpleescape(message.match[2]);
	var artistName = simpleescape(message.match[3]);
	console.log(songName);

	var requestURL = 'https://api.spotify.com/v1/search?q=track:%22' + songName + '%22%20artist:%22'+artistName+'%22&type=track&limit=1&market=US';
	console.log(requestURL);
  	request(requestURL, function (error, response, body) {

		if (!error && response.statusCode == 200) {
			
	  	 	var rawResponseJSON = JSON.parse( body );


			if (rawResponseJSON.tracks.total == 0 ) {

				bot.reply(message,'Sorry, couldn\'t find it. Be sure to double check the spelling, though. I\'m kind of a stickler.');

			} else {

				var track = rawResponseJSON.tracks.items[0];
				var trackName = '*"' + (track.name) + '"* by _' + (track.artists[0].name)+'_';

				  bot.startConversation(message,function(err,convo) {

				    convo.ask({
				    	"text":'To confirm, you wanted to play ' + trackName+', yeah?',
   						"icon_url":track.album.images[2].url,
						"username":bot.identity.name
				    },[
				      {
				        pattern: bot.utterances.yes,
				        callback: function(response,convo) {
				          convo.say('Adding now...');

						  request(process.env.PASSTHROUGH_SERVER + '/api/add/' + track.uri, function (error, response, body) {
					          convo.say('Done. Coming right up.');
					          convo.next();
						  });

				        }
				      },
				      {
				        pattern: bot.utterances.no,
				        callback: function(response,convo) {
				          convo.say('Phew. Glad I asked.');
				          convo.next();
				        }
				      },
				      {
				        default: true,
				        callback: function(response,convo) {
				          convo.repeat();
				          convo.next();
				        }
				      }
				    ]);

				  })
			}

		} else {
			bot.reply(message,'Shoot. For some reason, I couldn\'t make the request properly.');
		}  		

  	});

});


controller.hears(['playing','song is this'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/queue', function (error, response, body) {
		
		if (!error && response.statusCode == 200) {

	  	 	var rawResponseJSON = JSON.parse( body );
			
			if (rawResponseJSON.queue.length == 0 ) {
				bot.reply(message,'Nothing is currently playing.');
			} else {

				var track = rawResponseJSON.queue[0];
				var trackName = '*"' + track.name + '"* by _' + track.artists[0].name+'_';
				if ( track.radioPlay ) {
					trackName += ' _(autoplayed)_'
				}
				bot.reply(message,{
					"username":bot.identity.name,
					"text":trackName,
					"icon_url":track.album.images[2].url,
				});
			}

		} else {
			bot.reply(message,'Shoot. For some reason, I couldn\'t figure out what is playing.');
		}
	});
});

controller.hears(['stop','pause','play'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/pause', function (error, response, body) {
		bot.reply(message,getMessage(MESSAGE_DONE));
	});
});

controller.hears(['skip','next'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request('http://passthrough-reiling.rhcloud.com/api/skip', function (error, response, body) {
//		bot.reply(message,'Cool. I didn\'t like that one, either.');
		bot.reply(message,getMessage(MESSAGE_SKIP));
		
	});
});

controller.hears(['down'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/volume/-10', function (error, response, body) {
		bot.reply(message,getMessage(MESSAGE_VOLUME_DOWN));
	});
});

controller.hears(['up'],['direct_message','direct_mention','mention'],function(bot,message) {
  
  	request(process.env.PASSTHROUGH_SERVER + '/api/volume/+10', function (error, response, body) {
		bot.reply(message,getMessage(MESSAGE_VOLUME_UP));
	});
});

controller.hears(['help','what do you do'],['direct_message','direct_mention','mention'],function(bot,message) {
  
	bot.reply(message,'Find out *what\'s playing*, *pause*, *play*, *skip* or turn the volume *up* or *down*. You can also add songs to the queue (_"play Loud Pipes by Ratatat"_) or even entire albums (_"add the album Revolver by The Beatles"_.)');
});

// receive outgoing or slash commands
// if you are already using Express, you can use your own server instance...

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 3000
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
 
server.listen(server_port, server_ip_address, function () {
  console.log( "Listening on " + server_ip_address + ", server_port " + server_port )
  controller.createWebhookEndpoints(app);
});


controller.on('slash_command',function(bot,message) {

  // reply to slash command
  bot.replyPublic(message,'Everyone can see the results of this slash command');

});

function simpleescape(s) {

	s = s.replace("'",'\'')
	s = s.replace("’",'\'')
	s = s.replace('"','')
	s = s.replace('”','')
	s = s.replace('“','')

	return s;
}

var MESSAGE_SKIP = "messageSkip"
var MESSAGE_VOLUME_UP = "messageVolumeUp"
var MESSAGE_VOLUME_DOWN = "messageVolumeDown"
var MESSAGE_DONE = "messageDone"

var responses = [];
responses[MESSAGE_SKIP] = []
responses[MESSAGE_SKIP].push('Yeah, I didn\'t like that one, either.');
responses[MESSAGE_SKIP].push('On to the next one.');
responses[MESSAGE_SKIP].push(':point_right: :+1:');


responses[MESSAGE_VOLUME_UP] = []
responses[MESSAGE_VOLUME_UP].push('Turnt.');
responses[MESSAGE_VOLUME_UP].push('Bumped it a little bit.');
responses[MESSAGE_VOLUME_UP].push(':the_horns:');

responses[MESSAGE_VOLUME_DOWN] = []
responses[MESSAGE_VOLUME_DOWN].push('Shhhh.');
responses[MESSAGE_VOLUME_DOWN].push('Ok, kicked it down.');
responses[MESSAGE_VOLUME_DOWN].push('Got it. :point_down:');

responses[MESSAGE_DONE] = []
responses[MESSAGE_DONE].push(':facepunch:');
responses[MESSAGE_DONE].push('Done.');
responses[MESSAGE_DONE].push('Got it.');
responses[MESSAGE_DONE].push('Ok.');

function getMessage(key) {

	var l = responses[key].length-1;
	var index = Math.round(Math.random() * l)
	return responses[key][index]
}
