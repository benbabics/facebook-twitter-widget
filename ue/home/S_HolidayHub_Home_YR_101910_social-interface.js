(function(w,d,$,undefined) {
	/*
	 * extend :: Helper Method
	*/
	function extend (subclass, superclass) {
		var F = function() {};
			F.prototype = superclass.prototype;
		subclass.prototype = new F();
		subclass.prototype.constructor = subclass;
		subclass.superclass = superclass.prototype;
		if (superclass.prototype.constructor == Object.prototype.constructor) {
			superclass.prototype.constructor = superclass;
		}
	};
	
	/*
	 * Interface :: Helper Class
	*/
	var Interface = function(methods) {
		if (!$.isArray(methods)) {
			throw new Error('Interface constructor expects an array of public methods as an argument');
		}		
		for (i=0; i < methods.length; i++) {
			if (typeof methods[i] !== 'string') {
				throw new Error('Interface constructor expects method names to be passed in as a string.');
			}
		}
		
		return {
			ensureImplementation: function(obj) {
				for (i=0; i < methods.length; i++) {
					var method = methods[i];
					if (obj[method] == null) {
						throw new Error('Object does not implement all of the properties/methods from this interface. Method: "' + method + '", was not found.');
					}
				}
			}
		}
	};
	
	/*
	 * Observer :: Helper Class
	*/
	var Observer = function() {
		this.subscribers = [];
	};
	Observer.prototype = {
		subscribe: function(fn) {
			if ($.inArray(fn, this.subscribers) == -1) {
				this.subscribers.push(fn);
			}
			return this;
		},
		unsubscribe: function(fn) {
			var index = $.inArray(fn, this.subscribers);
			if (index >= 0) this.subscribers.splice(index, 1);
			return this;
		},
		notify: function(o, callback) {
			$(this.subscribers).each(function() {
				this(o);
			});
			if ($.isFunction(callback)) callback();
			return this;
		}
	};
	
	/*
	 * Formatter :: Helper Class
	*/
	var Formatter = function(options) {
		var config = $.extend({
			regex: []
		}, options);
		this.regex = $.isArray(config.regex) ? config.regex : [];
	};
	Formatter.prototype = {
		format: function(html, obj) {
			html = html || "<h1 style='color:red;'>Formatting Error: HTML was not defined!</h1>";
			var _this = this;
			html = html.replace(/\{[^\}]*\}/g, function(key) {
				var str = (obj[key.slice(1,-1)] || '');
				$(_this.regex).each(function() {
					str = this(str, key.slice(1,-1));
				});
				return str;
			});
			return $(html);
		}
	};


	/************************
	**** Feed Definitions
	************************/
	/* Feed - Interface :: Interface */
	var I_Feed = new Interface([
		'getFeed','setFeed','init','parseFeed','onFeedUpdate','onFeedChanged'
	]);
	
	/* Feed - Abstract :: Class */
	var FeedAbstract = function(conf) {
		//conf = $.isPlainObject(conf) ? conf : {};
		this.formatter = new Formatter(conf);
		this._feed = null;
		this._onFeedUpdate = new Observer();
		this._onFeedChanged = new Observer();
	};
	FeedAbstract.prototype = {
		getFeed: function() {
			return this._feed;
		},
		setFeed: function(feed) {
			this._feed = feed;
		},
		onFeedUpdate: function(fn) {
			if ($.isFunction(fn)) {
				this._onFeedUpdate.subscribe(fn);
			}
		},
		onFeedChanged: function(fn) {
			if ($.isFunction(fn)) {
				this._onFeedChanged.subscribe(fn);
			}
		}
	};
	
	
	/*************************************
	**** Feed || Class Implementations
	*************************************/
	/* Feed - Facebook :: Class */
	var FeedFb = function(comp) {
		FeedFb.superclass.constructor.call(this, {
			regex: [
				function(str, key) {
					return (key == 'updated_time') ? $.timeago(str) : str;
				},
				function(data, key) {
					if ($.isPlainObject(data) && key == 'likes') {
						var count = data.count,
							text  = count += (count > 1) ? " people like this." : " person likes this.";
						return "<div class='"+Main.config().prefix+"ui-post-like'>" + text + "</div>";
					}
					return data;
				}
			]
		});
		
		// public accessors
		this.$item = null;
		this.$comp = comp;
	};
	extend(FeedFb, FeedAbstract);
	
	/* Feed - Twitter :: Class */
	var FeedTw = function(comp) {
		FeedTw.superclass.constructor.call(this, {
			regex: [
				// hyperlinks (must be first)
				function(str) {
					return str.replace(/ ((?:http|https):\/\/[a-z0-9\/\?=_#&%~-]+(\.[a-z0-9\/\?=_#&%~-]+)+)|(www(\.[a-z0-9\/\?=_#&%~-]+){2,})/gi, ' <a href="$1">$1</a>');
				},
				// topics (must be second)
				function(str) {
					return str.replace(/#(\S+)/ig, '<a href="http://twitter.com/search?q=$1">#$1</a>');
				},
				// mentions (must be third)
				function(str) {
					return str.replace(/@(\S+)/ig, '@<a href="http://twitter.com/$1">$1</a>');
				}
			]
		});
		
		// public accessors
		this.$item = null;
		this.$comp = comp;
	};
	extend(FeedTw, FeedAbstract);
	
	
	/******************************
	**** Feed :: Public Methods
	******************************/
	/* Feed - Facebook :: Public Methods */	
	FeedFb.prototype.init = function(o) {
		// assign feed
		this.setFeed(o.feed);
		
		// create $item
		this.$item = this.formatter.format(
			this.getMarkup('_post'),
			o.profile
		);
		return this;
	};
	FeedFb.prototype.getMarkup = function(type) {
		switch(type) {
			case "_post":
				return "<li class='"+Main.config().prefix+"autoclear'><a href='{link}' class='"+Main.config().prefix+"ui-post-picture'><img src='http://graph.facebook.com/{username}/picture' /></a><div class='"+Main.config().prefix+"ui-post-container'><a href='{link}'>{name}</a>&nbsp;</div></li>";
				break;
			case "link":
			case "photo":
				return "<span>{message}</span><div class='"+Main.config().prefix+"ui-post-attachment "+Main.config().prefix+"autoclear'><a href='{link}' class='"+Main.config().prefix+"ui-post-picture'><img src='{picture}' /></a><div class='"+Main.config().prefix+"ui-post-container'><a href='{link}'>{name}</a> <p>{caption}</p><p>{description}</p></div></div><div class='"+Main.config().prefix+"ui-post-details'><p><img src='{icon}' />{updated_time}</p></div>{likes}";
				break;
			case "video":
				return "<span>{message}</span><div class='"+Main.config().prefix+"ui-post-attachment "+Main.config().prefix+"autoclear'><a href='{link}' class='"+Main.config().prefix+"ui-post-picture'><img src='{picture}' /><span class='"+Main.config().prefix+"ui-post-icon-video'></span></a><div class='"+Main.config().prefix+"ui-post-container'><a href='{link}'>{name}</a> <p>{caption}</p><p>{description}</p></div></div><div class='"+Main.config().prefix+"ui-post-details'><p><img src='{icon}' />{updated_time}</p></div>{likes}";
				break;
			case "status":
				return "<span>{message}</span><div class='"+Main.config().prefix+"ui-post-details'><p>{updated_time}</p></div>{likes}";
				break;
			case "empty":
				return "<p>There are no posts to display. Please check again later.</p>";
				break;
		}
	};
	FeedFb.prototype.parseFeed = function() {
		var _this = this;
		this._onFeedUpdate.notify();
		$(this.getFeed()).each(function(n) {
			var item = _this.formatter.format(
				_this.getMarkup(this.type),
				this
			);
			var post = _this.$item.clone();
				post.find('.'+Main.config().prefix+'ui-post-container:first').append(item);
			_this.$comp.append(post);
		});
		if (!this.getFeed().length) {
			_this.$comp.append(_this.formatter.format(
				_this.getMarkup('empty')
			));
		}
		this._onFeedChanged.notify();
		return this;
	};

	/* Feed - Twitter :: Public Methods */
	FeedTw.prototype.init = function(o) {
		// assign feed
		this.setFeed(o.feed);
		
		// create $item
		this.$item = this.formatter.format(
			this.getMarkup('_post'),
			o.profile
		);
		return this;
	};
	FeedTw.prototype.getMarkup = function(type) {
		switch(type) {
			case "_post":
				return "<li class='autoclear'><a href='http://twitter.com/{screen_name}' class='"+Main.config().prefix+"ui-post-picture'><img src='{profile_image_url}' /></a><div class='"+Main.config().prefix+"ui-post-container'></div></li>";
				break;
			case "status":
				return "<span>{text}</span>";
				break;
			case "empty":
				return "<p>There are no posts to display. Please check again later.</p>";
				break;
		}
	};
	FeedTw.prototype.parseFeed = function() {
		var _this = this;
		this._onFeedUpdate.notify();
		$(this.getFeed()).each(function(n) {
			var item = _this.formatter.format(
				_this.getMarkup('status'),
				this
			);
			var post = _this.$item.clone();
				post.find('.'+Main.config().prefix+'ui-post-container').append(item);
			_this.$comp.append(post);
		});
		if (!this.getFeed().length) {
			_this.$comp.append(_this.formatter.format(
				_this.getMarkup('empty')
			));
		}
		this._onFeedChanged.notify();
		return this;
	};
	
	
	/*************************************
	**** Initialize social feeds
	*************************************/
	w.fbAsyncInit = function() {
		var config = Main.config();
		var conf = {},
			feed = new FeedFb($('#'+config.prefix+'feed-fb ul.'+config.prefix+'comp-feed'));
			
		// ensure feed instance is valid
		I_Feed.ensureImplementation(feed);
			
		// subscribe to onFeedUpdate event
		feed.onFeedUpdate(function() {
			$('#'+config.prefix+'feed-fb').addClass(config.prefix+'ui-loader')
			.find('.'+config.prefix+'comp-feed').empty().fadeOut('fast');
		});
			
		// subscribe to onFeedChanged event
		feed.onFeedChanged(function() {
			$('#'+config.prefix+'feed-fb').removeClass(config.prefix+'ui-loader')
			.find('.'+config.prefix+'comp-feed').fadeIn('slow');
		});
			
		// set profile
		FB.api('/'+config.fbBrand, function(o) {
			conf.profile = o;
			o.username = o.username || config.fbBrand;
			
			// set posts
			FB.api('/'+config.fbBrand+'/posts', {limit:10}, function(o) {
				conf.feed = o.data;
				
				// initialize & parse feed
				feed.init(conf).parseFeed();
			});
		});
		
		// update feed
		FB.Event.subscribe('auth.statusChange', function(o) {
			feed.setFeed(o).parseFeed();
		});
	};
	
	w.twAsyncInit = function(o) {
		var config = Main.config();
		var conf = {},
			feed = new FeedTw($('#'+config.prefix+'feed-tw ul.'+config.prefix+'comp-feed'));
			
		// ensure feed instance is valid
		I_Feed.ensureImplementation(feed);
			
		// subscribe to onFeedUpdate event
		feed.onFeedUpdate(function() {
			$('#'+config.prefix+'feed-tw').addClass(config.prefix+'ui-loader')
			.find('.'+config.prefix+'comp-feed').empty().fadeOut('fast');
		});
			
		// subscribe to onFeedChanged event
		feed.onFeedChanged(function() {
			$('#'+config.prefix+'feed-tw').removeClass(config.prefix+'ui-loader')
			.find('.'+config.prefix+'comp-feed').fadeIn('slow');
		});
		
		// set profile
		conf.profile = (o.length) ? o[0].user : [{}];

		// set posts
		conf.feed = o;
		
		// initialize & parse feed
		feed.init(conf).parseFeed();
	};
	
	
	/*************************************
	**** Initialize Main
	*************************************/
	var Main = (function() {
		var conf = {
			fbBrand: false,
			twBrand: false,
			prefix: ""
		};
		
		function filterFeedControllers() {
			if (!conf.fbBrand) $('#'+conf.prefix+'controls-feed-btn-fb').remove();
			if (!conf.twBrand) $('#'+conf.prefix+'controls-feed-btn-tw').remove();
		}
		function assignControllersListener() {
			$('.'+conf.prefix+'controls-feed-btn').live('click', function(evt) {
				evt.preventDefault();

				// prevent user from double clicking the same feed
				if ($(this).hasClass(conf.prefix+'ui-active')) return;

				// toggle active state between .controls-feed-btn
				$(this).addClass(conf.prefix+'ui-active').siblings().removeClass(conf.prefix+'ui-active');

				// toggle active state between .feed-comp
				$('.'+conf.prefix+'comp-feed').parent().fadeIn('slow').not(evt.target.hash).fadeOut('fast');
			}).filter(':first').trigger('click');
		}
		function embedSocialAPIScripts() {
			var scripts = "";
			if (conf.fbBrand) scripts += "<script src='http://connect.facebook.net/en_US/all.js' language='JavaScript'></script>";
			if (conf.twBrand) scripts += "<script src='http://twitter.com/statuses/user_timeline/"+conf.twBrand+".json?callback=twAsyncInit&count=15' language='JavaScript'></script>";
			$('body').append(scripts);
		}
		
		return {
			initialize: function(options) {
				$.extend(conf, options);
				filterFeedControllers();
				assignControllersListener();
				embedSocialAPIScripts();
			},
			config: function() {
				return conf;
			}
		}
	})();
	
	// assign Main to the global scope
	w.socialFeedGadget = Main;
})(window, this, jQuery);