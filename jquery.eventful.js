/**
 * jQuery functions and plugins for adding Google Analytics event tracking throughout a page.
 * Uses the new 'asynchronous' GA tracking syntax.
 * 
 * jquery.eventful.js
 * @version 0.2
 * Changelog:
 *   *  0.1 Initial implementation.
 *   *  0.2 Ironed out bugs with GA call (thanks bboyle). Added delay on default behaviours so GA has time to phone home before navigating away.
 *
 * @author Andrew Ramsden <http://irama.org/>
 * @see http://irama.org/web/dhtml/eventful/
 * @license GNU GENERAL PUBLIC LICENSE (GPL) <http://www.gnu.org/licenses/gpl.html>
 * 
 * @requires jQuery (tested with 1.6.4) <http://jquery.com/>
 * @requires jquery.url.js (tested with 2.0) <https://github.com/irama/jQuery-URL-Parser>
 * 
 * 
 * Use trackEvent plugin to add tracking to elements. For example:
 *     $('a').trackEvent('click', 'links' ...) // track clicks on links element
 * 
 * Generally: Start with the most specific rules, then get broader. Leave boolStack as 
 * default (false), then each element/evt is only ever tracked once. For example:
 *     $('a[href^="http://"google.com]').trackEvent('click', 'google-links') // track links to Google
 *     $('a[href^="http://"]').trackEvent('click', 'external-links') // track all other external links
 */

jQuery.eventful = (typeof jQuery.eventful !== 'undefined') ? jQuery.eventful : {} ;
jQuery.eventful.debugMode = (typeof jQuery.eventful.debugMode !== 'undefined') ? jQuery.eventful.debugMode : false ;
jQuery.eventful.internalSites = [window.location.protocol+'//'+window.location.hostname];
jQuery.eventful.tempNode = null;
//jQuery.eventful.internalSitesSelector = 'a[href^="'+jQuery.eventful.internalSites[0]+'"], form[target^="'+jQuery.eventful.internalSites[0]+'"]';


(function($) {// start closure

_gaq = (typeof _gaq !== 'undefined') ? _gaq : [];


/**
 * Use of this function binds specified sites (protocol, domain and path) together for reporting under the same profile.
 * 
 * @param array sitesToGlue An array of sites to glue together. Optional, default the array currently set using setInternalSites.
 */
$.glueSites = function (sitesToGlue) {
	_gaq.push(
		['_setDomainName', 'none'],
		['_setAllowLinker', true]
	);
	
	var sitesToGlue = (typeof sitesToGlue !== 'undefined') ? sitesToGlue : $.eventful.internalSites ;
	
	$(sitesToGlue).each(function(){
		
		// Glue together all links to matched domains
			$('a[href^="'+this+'"]').live('click', function(){
				if ($.eventful.debugMode) {
					$.eventfulDebug('_link; '+$(this).attr('href'));
				} else {
					_gaq.push(['_link', $(this).attr('href')]); return false;
				}
			});
		
		// Glue together all POST forms
			postForms = $('form[method="post"][action^="'+this+'"]');
			postForms.live('submit', function(){
				if ($.eventful.debugMode) {
					$.eventfulDebug('_linkByPost; '+$(this).attr('action'));
				} else {
					_gaq.push(['_linkByPost', this]); return false;
				}
			});
		
		// Glue together all GET forms
			getForms = $('form[action^="'+this+'"][method!="post"]');
			getForms.live('submit', function(){
				if ($.eventful.debugMode) {
					$.eventfulDebug('_link; '+$(this).attr('action'));
				} else {
					_gaq.push(['_link', $(this).attr('action')]); return false;
				}
			});
	});
	
};

/**
 * Use this function to establish which sites are considered 'internal' versus 'external' 
 * for the sake of tracking under a single profile.
 * After specifying the 'internal' sites, 'a:internal' and 'form:external' 
 * pseudo-selectors can be used.
 * 
 * @param array internalSites An array of strings containing protocol, domain and path 
 *              of the 'site' considered 'internal'. All other protocol//domain/path combos
 *              are considered 'external'.
 */
$.setInternalSites = function(internalSites) {
	
	/*var siteList = '';
	$(internalSites).each(function(){
		siteList += 'a[href^="'+this+'"], form[target^="'+this+'"], ';
	});*/
	
	$.eventful.internalSites = internalSites;
	//$.eventful.internalSitesSelector = siteList;
};

$.expr[':'].internal = function(obj) {
	$obj = $(obj);
	
	if (! $obj.is('[href], [action], [src]')) {
		return false;
	}
	
	var objURL = $obj.url()+'';
	var currentURL = '';
	for (id in $.eventful.internalSites) {
		currentURL = $.eventful.internalSites[id];
		if ( objURL.substring(0, currentURL.length) == currentURL ) {
			return true;
		}
	}
	return false;
};
$.expr[':'].external = function(obj) {
	$obj = $(obj);
	
	if (! $obj.is('[href], [action], [src]')) {
		return false;
	}
	
	var objURL = $obj.url()+'';
	var currentURL = '';
	for (id in $.eventful.internalSites) {
		currentURL = $.eventful.internalSites[id];
		if ( objURL.substring(0, currentURL.length) == currentURL ) {
			return false;
		}
	}
	return true;
};


/**
 * Use this plugin to add event tracking to an element.
 * 
 * @param string events The event(s) to track. e.g. 'hover click' or 'submit'.
 * @param String category The GA 'category' for an event.
 * @param String action The GA 'action' for an event. Optional, default '{evt}: (#id {or} 1/2) href/action'. Leave unset, or set to null to accept default.
 * @param String label The GA 'label' for an event. Optional, default 'On page: {Current page URL}'. Leave unset, or set to null to accept default.
 * @param String value The GA 'value' for an event. Optional, default ''.  Leave unset, or set to null to accept default.
 * @param Boolean boolStack If false, this rule will be only be applied if no other tracking rule already exists for this element/evt combo. Optional, default false.
 */
$.fn.trackEvent = function(events, category, action, label, value, boolStack) {
	
	
	$(this).each(function(){
		
		//liveSelector = $(this).selector;
		
		//$.debug('tracking: '+category);
		
		// TODO: check for pre-existing tracking independently when 'events' contains multiple events e.g. 'hover click'.
		// Get previous tracking info
			var tracking = $(this).data('eventful');
			if (typeof tracking === 'undefined') {
				tracking = {};
			}
			if (typeof tracking[events] === 'undefined') {
				tracking[events] = '';
			}
		
		// if not stacking, check if this element/event is already being tracked
			var boolStack = (typeof boolStack !== 'undefined') ? boolStack : false ;
			if (!boolStack && tracking[events] !== '') {
				return; // Don't stack a new tracker, just return
			}
		
		// Init default values
			var action = (typeof action === 'undefined' || action === null) ? null : action ;
			var label = (typeof label === 'undefined' || label === null) ? null : label ;
			var value = (typeof value === 'undefined' || value === null) ? null : value ;
		
		// Add event tracker
			$(this).bind(events, {
				'category': category,
				'action': action,
				'label': label,
				'value': value
			}, _trackAnEvent);
		
		//$.eventfulDebug(this);
		
		if ($.eventful.debugMode) {
			// flag with category (handy for debugging)
				$(this).addClass('tracking-'+category);
		}
		
		// record for later
			tracking[events] = 'tracked';
			$(this).data('eventful', tracking[events]);
		
		
	});
	
	
};


/**
 * Internal function for tracking an event.
 * Don't use this function directly, use $(this).trackEvent() plugin to add event tracking.
 * 
 * For normal events (the naturally triggered event), prevent the default
 * behaviour and ping Google instead. For the follow action, allow the Default
 * after a delay.
 */
_trackAnEvent = function (evtObj) {
	
	// if tempNode is set, don't do anything else, just return and let the default behaviour kick in
		if ($.eventful.tempNode !== null) {
			$.eventful.tempNode = null;
			//console.log('allowing default');
			return true;
		}
	
	//console.log('evt started');
	
	var evtTarget = '';
	
	if (evtObj.data.action !== null) {
		var action = evtObj.data.action;
	} else { // generate a unique reference for this action
		var targetIndex = '';
		switch (evtObj.target.nodeName) {
			default:
				evtTarget = $(this).accessibleText(); // works for all elements (e.g. 'p', or 'input[type=submit]')
			break;
			case 'A':
				sourceURL = $(this).attr('href');
				thisURL = $(this).url();
				evtTarget = thisURL;
				
				if (sourceURL === '#') {
					evtTarget = $(this).accessibleText();
				} else if ($(this).attr('id')+'' != 'undefined') {
					evtTarget = '(#'+$(this).attr('id')+') ' + thisURL;
				} else { // prepend a unique index for this link
					similarLinks = $('a[href="'+sourceURL+'"], a[href="'+thisURL+'"]');
					if (similarLinks.size() > 1) {
						evtTarget = '('+(similarLinks.index(evtObj.target)+1)+'/'+similarLinks.size()+') ' + thisURL;
					}
				}
			break;
			case 'FORM':
				sourceURL = $(this).attr('action');
				thisURL = $(this).url();
				evtTarget = thisURL;
				
				if ($(this).attr('id')+'' !== 'undefined') {
					evtTarget = '(#'+$(this).attr('id')+') ' + thisURL;
				} else { // prepend a unique index for this link
					similarForms = $('form[action="'+sourceURL+'"], form[action="'+thisURL+'"]');
					if (similarForms.size() > 1) {
						evtTarget = '('+(similarForms.index(evtObj.target)+1)+'/'+similarForms.size()+') ' + thisURL;
					}
				}
			break;
		}
		var action = evtObj.type + ': ' + evtTarget;
	}
	
	var category = evtObj.data.category; 
	var label = (evtObj.data.label !== null) ? label : 'On page: ' + window.location.href;
	var value = evtObj.data.value;
	
	
	
	$.eventfulDebug('_trackEvent; category: '+category+'; action: '+action+'; label: '+label+'; value: '+value+';');// return false;
	
	if (! $.eventful.debugMode) {
		
		// Prevent default behaviours and handlers
			evtObj.preventDefault();
			evtObj.stopPropagation();
		
		// Ping Google
			_gaq.push(['_trackEvent', category, action, label, value]);
		
		// Store the currently affected node, and delay to give GA a chance to phone home
			$.eventful.tempNode = evtObj;
			window.setTimeout(_reTriggerEventDefault, 200);
	}
	
	// Allow default behaviour in debug mode
};

/**
 * An internal function used to retrigger the native default behaviours for an
 * element we are tracking.
 */
_reTriggerEventDefault = function () {
	var evtObj = $.eventful.tempNode;
		//console.log (evtObj.type);
	//$(evtObj.target).trigger(evtObj.type, [allowDefault=true]);
	$(evtObj.target).get(0)[ evtObj.type ](); // trigger native behaviours
};

$(function(){
	if ($.eventful.debugMode) { // block all links and form submissions while in debugMode
		$('a').live('click',function(){return false;});
		$('form').live('submit',function(){return false;});
	}
});
$.eventfulDebug = function (message) {
	if (typeof console !== 'undefined' && typeof console.log !== 'undefined') {
		console.log(message);
	}
};

/**
 * jQuery plugin that returns the text nodes within the target element, 
 * combined/concatenated with any alt text or input values.
 * 
 * @author Andrew Ramsden
 * @author Ben Boyle
 */
$.fn.accessibleText = function() {
	
	if (this.is('img')) {
		return this.attr( 'alt' );
	} else if (this.is('input')) {
		return this.attr( 'value' );
	} else {
		return $.map( this.contents(), function( domElement ) {
			if ( domElement.nodeType === 3 ) {
				return domElement.data;
			} else if ( domElement.nodeType === 1 ) {
				var $element = $( domElement );
				if ( $element.is( 'img, imput' ) || $element.find( 'img[alt], input[value]' ).length > 0 ) {
					return $element.accessibleText();
				} else {
					return $element.text();
				}
			}
		}).join( '' );
	}
};



})(jQuery); /* end closure */

