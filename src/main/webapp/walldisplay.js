var updateTimeout;
var paintTimeout;

// - initialize variables ----------------------------------------------
var jenkinsTimeOut = getParameterByName("jenkinsTimeOut", 15000);
var lastJenkinsTimeOut = jenkinsTimeOut;

var jenkinsUpdateInterval = getParameterByName("jenkinsUpdateInterval", 20000);
var lastJenkinsUpdateInterval = jenkinsUpdateInterval;

var paintInterval = getParameterByName("jenkinsPaintInterval", 100);
var blinkInterval = 500;
var lastPaintInterval = paintInterval;
var arranDebug = true;
var jenkinsUrl = arranDebug ? "http://localhost:8080/" : getParameterByName("jenkinsUrl", window.location.protocol + "://" + window.location.host + "/"
    + window.location.pathname.replace("plugin/jenkinswalldisplay/walldisplay.html", ""));
var viewName = getParameterByName("viewName", "All");
var theme = getParameterByName("theme", "default");
var fontFamily = getParameterByName("fontFamily", "sans-serif");
var sortOrder = getParameterByName("sortOrder", "job name");
var buildRange = getParameterByName("buildRange", "all");
var customTheme = getParameterByName("customTheme", null);
var showDetails = false;
var showGravatar = false;
var jobGravatarCache = {};
var gravatarCounter = {};
var showBuildNumber = true;
var showWeatherReport = false;
var showLastStableTimeAgo = true;
var blinkBgPicturesWhenBuilding = false;
var showDisabledBuilds = true;
var maxQueuePositionToShow = 15;

var jobStatusOrder = [];
jobStatusOrder["blue"] = 0;
jobStatusOrder["blue_building"] = 1;
jobStatusOrder["red"] = 2;
jobStatusOrder["red_building"] = 3;
jobStatusOrder["yellow"] = 4;
jobStatusOrder["yellow_building"] = 5;
jobStatusOrder["aborted"] = 6;
jobStatusOrder["aborted_building"] = 7;
jobStatusOrder["grey"] = 8;
jobStatusOrder["grey_building"] = 9;

var isDebug = false;
var debugString = getParameterByName("debug", null);
if(debugString != null){
    isDebug = true;
}

// ---------------------------------------------------------------------
$.ajaxSetup({
    cache: false
});

var jobPadding = 5;
var jobMargin = 8;
var jobBorderWidth = 0;
var paintInterval = 1000;
var jobInfoTimout = 5000;

// ---------------------------------------------------------------------
var rows = 0;
var columns = 0;
var jobIndex = 0;
var jobsToDisplay = new Array();
var serverTime = 0;
var updateRunning = new Array();
var updateError = null;
var clientWidth;
var clientHeight;
var lastPluginVersion = null;
var lastTheme = "default";
var lastFontFamily = fontFamily;
var paintRunning = false;

// ---------------------------------------------------------------------
// themes
// ---------------------------------------------------------------------
var themes = {};
themes.christmas = {};
themes["default"] = {};

themes.christmas.start = function(){
    $(document).snowfall('clear');
    $(document).snowfall({
        round: true,
        minSize: 8,
        maxSize: 12
    }); // add rounded
};
themes.christmas.stop = function(){
    $(document).snowfall('clear');
};

$(document).ready(function(){
    $("abbr.timeago").timeago();

    debug("started jenkins wall display");
    debug("url '" + jenkinsUrl + "'");
    debug("view name: '" + viewName + "'");

    updateWindowSizes();

    document.title = "Jenkins Wall Display (" + viewName + ")";

    update();
	repaint();
});

window.onresize = function(event){
    updateWindowSizes();
};

function update() { 
	updateJobs();
	updatePluginConfiguration();
	updateTimeout = setTimeout(update, jenkinsUpdateInterval);
}


function updateJobs() {
	if (!updateRunning[viewName]) {
		debug("starting update of view " + viewName + " at every " + jenkinsUpdateInterval + "ms");
        getJenkinsApi(jenkinsUrl);
		debug("finished update of view " + viewName);
    }

    if (!updateRunning["queue"]) {
		debug("starting queue update of view " + viewName + " at every " + jenkinsUpdateInterval + "ms");
        getJenkinsQueue(jenkinsUrl);
		debug("finished update of view " + viewName);
	}
}

function updatePluginConfiguration() { 
	if (!updateRunning["pluginconfiguration"]) {
        getPluginConfiguration(jenkinsUrl);
    }
}

Math.logBase = function(n, base) {
    return Math.log(n) / Math.log(base);
};


function getQueueDivs(jobWidth, jobHeight, queuePosition) {
    var queueDivs = [],
		maxPerColumn = 3,
		perColumn = queuePosition;

    if (perColumn > maxPerColumn) {
        perColumn = maxPerColumn;
    }

    var queueColumns = Math.ceil(queuePosition / perColumn),
		maxQueueItems = maxQueuePositionToShow;
	
    if (queuePosition > maxQueueItems) {
        queuePosition = maxQueueItems;
    }

    var radius = Math.round(jobHeight / (maxPerColumn + 1));
    var increment = (jobHeight - perColumn * radius) / (perColumn + 1);

    var queueLeft = jobWidth - 2 * radius;

    for (queueColumn = 0; queueColumn < queueColumns; queueColumn++) {
        var queueTop = increment;

        for (i = 0; i < perColumn; i++) {
            if(queueDivs.length < queuePosition){
                var queueDiv = $('<div />');
                queueDiv.css({
                    "position": "absolute",
                    "top": queueTop + "px",
                    "left": queueLeft + "px",
                    "height": radius + "px",
                    "width": radius + "px",
                    "border-radius": +Math.round(radius / 2) + "px",
                    "-moz-border-radius": Math.round(radius / 2) + "px",
                    "-webkit-border-radius": Math.round(radius / 2) + "px"
                });
                queueDiv.addClass("queued");
                queueDivs.push(queueDiv);
            }
            queueTop += increment + radius;
        }

        queueLeft -= increment + radius;
    }

    return queueDivs;
}

function updateWindowSizes(){
    clientWidth = $(window).width();
    clientHeight = $(window).height();

    if ($("#debug").length > 0) {
        var now = new Date();
        $("#debug").css("height", (clientHeight - 80) + "px");
    }

    debug("clientHeight: " + clientHeight + ", clientWidth: " + clientWidth);
}

var cachedTextDimensions = [];
function getTextDimensions(text, fontSize) {

    var cacheKey = text + fontSize;

    if (!(cacheKey in cachedTextDimensions)) {
        $("#TextDimensionDiv").html(text);
        $("#TextDimensionDiv").css("font-size", fontSize + "px");

        var dimension = {};
        dimension.width = $("#TextDimensionDiv")[0].clientWidth;
        dimension.height = $("#TextDimensionDiv")[0].clientHeight;
        cachedTextDimensions[cacheKey] = dimension;

    }

    return cachedTextDimensions[cacheKey];
}

function getJobDimensions(job, fontSize) {

    var textDimensions = getTextDimensions(getJobText(job, showBuildNumber, showLastStableTimeAgo, showDetails),
        fontSize),
		dimension = {};
	
    dimension.width = textDimensions.width + 2 * jobPadding + 2 * jobBorderWidth;
    dimension.height = textDimensions.height + 2 * jobPadding + 2 * jobBorderWidth;

    return dimension;

}

function displayMessage(messageText, colorClass) {
    removeAllJobs();

    var messageMargin = 50,
		positionStyle = 'position: absolute; padding: ' + messageMargin + 'px; left: ' + messageMargin + 'px; top: ' + messageMargin + 'px; width:' + (clientWidth - 4 * messageMargin) + ';',
		divContent = '<div class="' + colorClass + '" style="' + positionStyle + '" id="Message">' + messageText + '</div>';

    if ($("#Message").length > 0) {
        $("#Message").replaceWith(divContent);
    } else {
        $("body").prepend(divContent);
    }
}

function blink(objs) {
    objs.fadeTo(blinkInterval, 0.33).fadeTo(blinkInterval, 1, function () {
        blink(objs);
    });
}

function isJobBuilding(job) {
    return job.color.substr(-6) === "_anime";
}

function jobHasHealthReport(job) {
    var healthReport = job.healthReport;

    return healthReport[0] !== undefined;
}

function repaint() {
    if (updateError) {
        displayMessage(updateError, "message_error");
    } else if (updateRunning[viewName]) {
        displayMessage("Loading jobs...", "message_info");
    } else if (jobsToDisplay.length === 0) {
        displayMessage("No jobs to display...", "message_info");
    } else {
        removeMessage();

        if (!updateRunning["repaint"]) {
            removeAllJobs();

            var longestJob = getLongestJob(jobsToDisplay, showBuildNumber, showLastStableTimeAgo, showDetails);
            var maxFontSize = 0;

            for (var columnCount = 1; columnCount <= jobsToDisplay.length; columnCount++) {
                for (var fontSize = 10; fontSize <= 302; fontSize++) {

                    var rowCount = Math.ceil(jobsToDisplay.length / columnCount);

                    var jobDimensions = getJobDimensions(longestJob, fontSize);

                    var totalWidth = jobDimensions.width * columnCount + jobMargin * (columnCount - 1);
                    var totalHeight = jobDimensions.height * rowCount + jobMargin * (rowCount - 1);

                    if (totalWidth <= clientWidth && totalHeight <= clientHeight) {
                        if (fontSize > maxFontSize) {
                            maxFontSize = fontSize;
                            rows = rowCount;
                            columns = columnCount;
                        }
                    } else {
                        break;
                    }
                }
            }

            var left = jobMargin;
            var jobIndex = 0;
            var jobWidth = Math.round((clientWidth - (columns + 1) * jobMargin) / columns);
            var top = jobMargin;
            var jobHeight = Math.round((clientHeight - (rows + 1) * jobMargin) / rows);
            var textDimensions = getTextDimensions("YgGy", maxFontSize);

            for (var column = 0; column < columns; column++) {

                if (column == 0) {
                    left = jobMargin;
                } else {
                    left += jobWidth + jobMargin;
                }

                for (var row = 0; row < rows; row++) {

                    if (row == 0) {
                        top = jobMargin;
                    } else {
                        top += jobHeight + jobMargin;
                    }

                    if (jobIndex < jobsToDisplay.length) {
                        var job = jobsToDisplay[jobIndex];
                        var isBuilding = isJobBuilding(job);
                        var jobColor = job.color;

                        if (isBuilding) {
                            jobColor = job.color.substr(0, job.color.length - 6);
                        }

                        var jobDimensions = getJobDimensions(job, maxFontSize);

                        var jobDimensionsStyle = {
                            "width": jobWidth,
                            "height": jobHeight
                        };
                        var jobPositionStyle = {
                            "position": "absolute",
                            "top": top,
                            "left": left
                        };

                        var percentageDiv = $('<div />');
                        var jobOverdue = false;
                        if(isBuilding && job.lastBuild != null && job.lastBuild.timestamp != null
                            && job.lastSuccessfulBuild != null && job.lastSuccessfulBuild.duration != null){
                            var currentDuration = serverTime - job.lastBuild.timestamp;
                            var percentage = currentDuration / (job.lastSuccessfulBuild.duration / 100);
                            var percentageWidth = Math.round(jobWidth / 100 * percentage);

                            if(percentageWidth > jobWidth){
                                percentageWidth = jobWidth;
                                jobOverdue = true;
                            }

                            percentageDiv.css({
                                "height": jobHeight + "px",
                                "width": percentageWidth + "px",
                                "left": "0px",
                                "top": Math.round((jobHeight - textDimensions.height) / 2) + "px"
                            });
                            percentageDiv.addClass("theme");
                            percentageDiv.addClass(jobColor);
                            percentageDiv.addClass("building");
                            percentageDiv.addClass("job");
                        }

                        var queueDivs = getQueueDivs(jobWidth, jobHeight, getBuildQueuePosition(job.name));

                        // - create the gravatar img ------------------------
                        if (!jobGravatarCache[job.name] || gravatarCounter[job.name] >= 5) {
                            var jobGravatar = $('<img />');
                            jobGravatar.attr('src', getGravatarUrl(job, showGravatar, Math
                                .round(jobDimensions.height * 0.80)));
                            jobGravatar.css({
                                "float": "left",
                                "padding-top": Math.round((jobDimensions.height * 0.50)
                                    - (Math.round(jobDimensions.height * 0.40))),
                                "padding-left": "5%"
                            });

                            jobGravatarCache[job.name] = jobGravatar;
                            gravatarCounter[job.name] = 0;
                        } else {
                            gravatarCounter[job.name] = parseInt(gravatarCounter[job.name]) + 1;
                        }

                        // - create the job content div ---------------------
                        var jobContent = $('<div />');
                        jobContent.css({
                            "position": "absolute",
                            "top": Math.round((jobHeight - textDimensions.height) / 2) + 'px'
                        });
                        jobContent.addClass("job_content");
                        jobContent.css(jobDimensionsStyle);
                        jobContent.text(getJobText(job, showBuildNumber, showLastStableTimeAgo, showDetails));

                        // - create the job wrapper div ---------------------
                        var jobWrapper = $('<div />').attr({
                            "id": job.name
                        });

                        if(isBuildClaimed(job)){
                            jobWrapper.addClass("claimed");
                        }

                        jobWrapper.css({
                            "font-size": (maxFontSize - 1) + "px",
                        });

                        jobWrapper.css(jobPositionStyle);
                        jobWrapper.css(jobDimensionsStyle);
                        jobWrapper.addClass("job");
                        jobWrapper.addClass("job_wrapper");
                        jobWrapper.addClass(theme);
                        jobWrapper.addClass(jobColor);

                        if (showWeatherReport && jobHasHealthReport(job))
                        {
                            var jobWeatherReport = $('<div />');

                            var healthImageIndex = Math.ceil((job.healthReport[0].score) / 20);
                            healthImageIndex = Math.max(healthImageIndex, 1);
                            healthImageIndex = Math.min(healthImageIndex, 5);

                            var healthImageSize = Math.pow(2, Math.floor(Math.logBase(jobHeight, 2)));
                            healthImageSize = Math.max(healthImageSize, 16);
                            healthImageSize = Math.min(healthImageSize, 512);

                            jobWeatherReport.css({
                                "background-image": "url('images/health_images/health_" + healthImageIndex + "_" + healthImageSize + "x" + healthImageSize +".png')",
                                "background-position": "center center",
                                "background-repeat": "no-repeat",
                                "width": (healthImageSize*1.4) + "px",
                                "height": (jobHeight) + "px"
                            });

                            jobWeatherReport.addClass("job_weather_report");
                            jobWrapper.append(jobWeatherReport);
                        }

                        // - assemble job divs ------------------------------
                        if(showGravatar) jobWrapper.append(jobGravatarCache[job.name]);

                        $.each(job.property, function(index, property){
                            if(property.wallDisplayBgPicture != null && property.wallDisplayBgPicture != ""){
                                // - create the job bg div ---------------------
                                var jobBg = $('<div />');
                                jobBg.css({
                                    "position": "absolute",
                                    "transform": "rotate(-30deg)",
                                    "top": '0px',
                                    "left": Math.floor((jobWidth) * 2 / 6) + 'px',
                                    "background-image": "url('" + property.wallDisplayBgPicture + "')",
                                    "opacity": "0.5",
                                    "background-size": Math.floor((jobWidth) / 6) + "px " + jobHeight + "px",
                                    "background-repeat": "no-repeat",
                                    "width": Math.floor((jobWidth) / 6) + "px",
                                    "height": (jobHeight) + "px"
                                });
                                jobBg.addClass((!isBuilding ? "in" : "") + "activeJob");
                                jobWrapper.append(jobBg);
                            }
                        });
                        jobWrapper.append(jobContent);
                        jobWrapper.append(percentageDiv);
                        $.each(queueDivs, function(index, queueDiv){
                            jobWrapper.append(queueDiv);
                        });

                        jobContent.click({
                            "job": job
                        }, function(eventData){
                            showJobinfo(eventData.data.job);
                        });

                        $("body").prepend(jobWrapper);

                        jobIndex++;
                    }
                }

                if(!blinkBgPicturesWhenBuilding){
                    $(".activeJob").clearQueue();
                }else{
                    if(jQuery.queue($(".activeJob"), "fx").length == 0){
                        blink($(".activeJob"));
                    }
                }
            }
        }
    }
	
	paintTimeout = setTimeout(repaint, paintInterval);
}

function removeAllJobs(){
    $(".job").remove();
}

function hasJobFailed(job) {
  return job.color === "blue";
}

function isJobDisabled(job) {
  return job.color === 'disabled';
}

function getJobs(jobNames){
    updateRunning["repaint"] = false;
	jobsToDisplay = [];

    $
        .each(
            jobNames,
            function(index, jobName){
                if (!updateRunning[jobName]) {
                    debug("starting getting api for job '" + jobName + "'");
                    updateRunning[jobName] = true;

                    $
                        .ajax({
                            url: jenkinsUrl + "/job/" + jobName + "/api/json",
                            dataType: "json",
                            data: {
                                "tree": "healthReport[score],property[wallDisplayName,wallDisplayBgPicture],name,color,priority,lastStableBuild[timestamp]," +
                                "lastBuild[number,timestamp,duration,actions[parameters[name,value],claimed,claimedBy,reason,failCount,skipCount,totalCount],culprits[fullName,property[address]]]," +
                                "lastCompletedBuild[number,timestamp,duration,actions[parameters[name,value],claimed,claimedBy,reason, failCount,skipCount,totalCount],culprits[fullName,property[address]]]," +
                                		"lastSuccessfulBuild[duration]"
                            },
                            success: function(job, textStatus, jqXHR){

								var addJob = true;
                                if(!showDisabledBuilds && isJobDisabled(job)){
									addJob = false;
                                }

                                // show all failed builds, but only show passing
                                // builds
                                // in the date range the user specifies
                                //
                                // The times are approximate - we're not being
                                // totally precise,
                                // so a day is considered the last 24 hours, a
                                // week the last
                                // 7 days, and a month the last 31 days. It's
                                // just so the
                                // build screen doesn't fill up with builds.
                                if(hasJobFailed(job)){

                                    var timestamp = new Date().getTime();
                                    var ONE_DAY_MS = 86400000;
                                    var minTimestamp = 0;
                                    switch(buildRange){
                                        case 'active today': // last 24 hours
                                            minTimestamp = timestamp - ONE_DAY_MS;
                                            break;
                                        case 'active this week':
                                            minTimestamp = timestamp - ONE_DAY_MS * 7;
                                            break;
                                        case 'active this month':
                                            minTimestamp = timestamp - ONE_DAY_MS * 31;
                                            break;
                                    }

                                    if(job.lastBuild && job.lastBuild.timestamp < minTimestamp){
										addJob = false;
                                    }
                                }

								if (addJob) {
									jobsToDisplay.push(job);
								}

                                jobsToDisplay.sort(function(job1, job2) {

                                    var sort = 0;

                                    if (sortOrder == "job status") {
                                        sort = jobStatusOrder[job1.color] - jobStatusOrder[job2.color];
                                    } else if (sortOrder == "job priority") {
                                        sort = job1.priority - job2.priority;
                                    }

                                    if(sort == 0){
                                        sort = getJobText(job1, showBuildNumber, showLastStableTimeAgo, showDetails)
                                            .localeCompare(
                                                getJobText(job2, showBuildNumber, showLastStableTimeAgo, showDetails));
                                    }

                                    return sort;
                                });

                                updateRunning[jobName] = false;
                            },
                            error: function(e, xhr){
                                debug("error getting api for job '" + jobName + "': '" + e.statusText + "'");
                                updateRunning[jobName] = false;
                            },
                            timeout: jenkinsTimeOut
                        });

                }
            });
}

function getJobNamesToDisplay(viewApi){
    var jobNames = [];

    $.each(viewApi.jobs, function(index, job){
        jobNames.push(job.name);
    });

    if(viewApi.views && viewApi.views.length){
        $.each(viewApi.views, function(index, nestedView){
            $.each(nestedView.jobs, function(index, job){
                jobNames.push(job.name);
            });
        });
    }

    return jobNames;
}

function debug(logMessage) {
	if (isDebug) {
		console.log(logMessage);
	}
}

function showJobinfo(job) {
    $("#JobInfo").remove();
    if(!$("#JobInfo").length){
        var jobInfoDiv = $('<div />').attr({
            "id": "JobInfo"
        }).addClass("job_info");

        var url = jenkinsUrl + "/view/" + viewName + "/job/" + job.name;

        jobInfoDiv.append($('<h1 />').append($('<a />', {href: url, text: getJobTitle(job) })));

        if (job.lastStableBuild && job.lastBuild.color != "blue"){
            jobInfoDiv.append($('<p />')
                .append("Broken For  " + getUserFriendlyTimespan(serverTime - job.lastStableBuild.timestamp)));
        }

        jobInfoDiv.append($('<p />').append($('<a />', {href: url + "/changes", text: "Recent Changes" })));

        if (isJobBuilding(job)){
            if (job.lastSuccessful)
                jobInfoDiv.append($('<p />').text("Last successful build took " + getUserFriendlyTimespan(serverTime - job.lastSuccessful.duration)));
            // last and last completed will be the same if not building.
            addBuildDetails(jobInfoDiv, job.lastBuild, "Currently Building #" + job.lastBuild.number, url);
            addBuildDetails(jobInfoDiv, job.lastCompletedBuild, "Last Completed Build #" + job.lastCompletedBuild.number, url);
        }
        else{
            addBuildDetails(jobInfoDiv, job.lastBuild, "Last Build #" + job.lastBuild.number, url);
        }
        jobInfoDiv.click(function(){
            $("#JobInfo").remove();
        });

        $("body").append(jobInfoDiv);
    }
}

function addBuildDetails(jobInfoDiv, build, buildType, url){
    if(build != null){
        jobInfoDiv.append($('<h2 />').append($('<a />', {href: url + "/" +build.number, text: buildType })));

        if (build.culprits && build.culprits.length) {
            var culprits =  "Culprits: ";
            $.each(build.culprits, function(index, culprit){
                culprits += culprit.fullName + ", ";
            });
            jobInfoDiv.append($('<p />').text(culprits));
        }

        if(build.actions != null){
            $.each(build.actions, function(actionIndex, action){
                if(action && action.claimed){
                    jobInfoDiv.append($('<p />').append("Claimed by " + action.claimedBy + ': "').append($('<span />', {text: action.reason}).addClass("claim")).append('"'));
                }
            });
            $.each(build.actions, function(actionIndex, action){
                if(action && action.totalCount){
                    var jobClaim = $('<p />');
                    jobClaim.append($('<a />', {href: url + "/" +build.number + "/testReport", text: "Tests" }));
                    jobClaim.append(": " + action.totalCount + " total ");
                    if(action.skipCount){
                        jobClaim.append($('<span />').text(action.skipCount + " skipped ").addClass('skipped'));
                    }
                    if(action.failCount){
                        jobClaim.append($('<span />').text(action.failCount + " failed ").addClass('failed'));
                    }
                    jobInfoDiv.append(jobClaim);
                }
            });
        }

        var buildText =  "Started " + getUserFriendlyTimespan(serverTime - build.timestamp)
            + " ago";
        if (build.duration)
            buildText += " and  took " + getUserFriendlyTimespan(build.duration);
        jobInfoDiv.append($('<p />').text(buildText));
        jobInfoDiv.append($('<p />').append($('<a />', {href: url + "/" +build.number+"/console", text: "Console Output" })));
    }
}

function updateShutdownMessage(quietingDown){
    if(!quietingDown){
        $("#ShuttingDown").remove();

    }else if(!$("#ShuttingDown").length){

        var shuttingDownDiv = $('<div />').attr({
            "id": "ShuttingDown"
        });
        shuttingDownDiv.addClass("shuttingdown");

        var title = $('<p />');
        title.text("Jenkins is going to shut down");
        shuttingDownDiv.append(title);

        $("body").append(shuttingDownDiv);
    }
}

function getJenkinsApi(jenkinsUrl) {

    debug("starting getting jenkins api");
    updateRunning[viewName] = true;

    // - get jenkins api ------------------------------------------------
    $.ajax({
        url: jenkinsUrl + "/view/" + viewName + "/api/json",
        dataType: 'json',
        data: {
            "depth": 1
        },
        success: function(viewApi, textStatus, jqXHR){
            debug("finished getting jenkins api");

            var dateHeader = jqXHR.getResponseHeader("Date");
            var date = new Date(dateHeader);
            serverTime = date.getTime();

            var jobNames = getJobNamesToDisplay(viewApi);
            getJobs(jobNames);

            updateShutdownMessage(viewApi.quietingDown);
            updateRunning[viewName] = false;
            updateError = null;
        },
        error: function(e, xhr){
            debug("error getting jenkins api: '" + e.statusText + "'");
            updateRunning[viewName] = false;
            updateError = e.statusText;
            jobsToDisplay = new Array();
        },
        timeout: jenkinsTimeOut
    });
}

function getBuildQueuePosition(jobName){
    var queuePosition = 0;

    if(buildQueue != null){
        $.each(buildQueue["items"], function(index, queueItem){

            if(queueItem != null && queueItem.task != null && queueItem.task.name != null
                && queueItem.task.name == jobName){
                queuePosition = index + 1;
            }
        });
    }
    return queuePosition;
}

var buildQueue = null;
function getJenkinsQueue(jenkinsUrl) {

    debug("starting getting queue api");
    updateRunning["queue"] = true;

    // - get build queue ------------------------------------------------
    $.ajax({
        url: jenkinsUrl + "/queue/api/json",
        dataType: 'json',
        success: function(queue, textStatus, jqXHR){

            debug("finished getting queue api");
            buildQueue = queue;
            updateRunning["queue"] = false;
        },
        error: function(e, xhr){
            debug("error getting queue api: '" + e.statusText + "'");
            updateRunning["queue"] = false;
        },
        timeout: jenkinsTimeOut
    });
}

function getPluginConfiguration(jenkinsUrl) {

    debug("starting getting plugin api");
    updateRunning["pluginconfiguration"] = true;

    // - get plugin version ------------------------------------------------
    $.ajax({
        url: jenkinsUrl + "/plugin/jenkinswalldisplay/api/json?depth=1",
        dataType: 'json',
        success: function(plugin, textStatus, jqXHR){
            debug("finished getting plugin api, plugin configuration: '" + plugin.version + "'");
            updateRunning["pluginconfiguration"] = false;

            if(lastPluginVersion != null && lastPluginVersion != plugin.version){
                window.location.reload();
            }

            lastPluginVersion = plugin.version;

            if(plugin.config && plugin.config != null){
                // parameters specified in URL should override any set in plugin config.
                if (plugin.config.theme && plugin.config.theme != null) {
                    theme = getParameterByName('theme', plugin.config.theme.toLowerCase());
                }

                if (plugin.config.customTheme && plugin.config.customTheme != null) {
                    customTheme = getParameterByName('customTheme', plugin.config.customTheme);
                }

                if (plugin.config.buildRange && plugin.config.buildRange != null) {
                    buildRange = getParameterByName('buildRange', plugin.config.buildRange.toLowerCase());
                }

                if (plugin.config.fontFamily && plugin.config.fontFamily != null) {
                    fontFamily = getParameterByName('fontFamily', plugin.config.fontFamily.toLowerCase());
                }

                if (plugin.config.sortOrder && plugin.config.sortOrder != null) {
                    sortOrder = getParameterByName('sortOrder', plugin.config.sortOrder.toLowerCase());
                }

                if (plugin.config.showDetails != null) {
                    showDetails = getParameterByName('showDetails', plugin.config.showDetails);
                }

                if (plugin.config.showGravatar != null) {
                    showGravatar = getParameterByName('showGravatar', plugin.config.showGravatar);
                }

                if (plugin.config.showBuildNumber != null) {
                    showBuildNumber = getParameterByName('showBuildNumber', plugin.config.showBuildNumber);
                }

                if (plugin.config.showWeatherReport != null) {
                    showWeatherReport = getParameterByName('showWeatherReport', plugin.config.showWeatherReport);
                }

                if (plugin.config.showLastStableTimeAgo != null) {
                    showLastStableTimeAgo = getParameterByName('showLastStableTimeAgo', plugin.config.showLastStableTimeAgo);
                }

                if (plugin.config.blinkBgPicturesWhenBuilding != null) {
                    blinkBgPicturesWhenBuilding = getParameterByName('blinkBgPicturesWhenBuilding', plugin.config.blinkBgPicturesWhenBuilding);
                }

                if (plugin.config.showDisabledBuilds != null) {
                    showDisabledBuilds = getParameterByName('showDisabledBuilds', plugin.config.showDisabledBuilds);
                }

                if (isNumber(plugin.config.jenkinsUpdateInterval)) {
                    jenkinsUpdateInterval = getParameterByName('jenkinsUpdateInterval', plugin.config.jenkinsUpdateInterval) * 1000;
                }

                if (isNumber(plugin.config.paintInterval)) {
                    paintInterval = plugin.config.paintInterval * 1000;
                    // Blink interval is the time interval for
                    // fadingOut/fadingIn
                    // of background pictures of jobs
                    blinkInterval = (paintInterval == 0 ? 1000 : paintInterval);
                    do {
                        blinkInterval /= 2;
                    } while(blinkInterval > 3000);
                }

                if(isNumber(plugin.config.jenkinsTimeOut)){
                    jenkinsTimeOut = plugin.config.jenkinsTimeOut * 1000;
                }
            }

            if (lastJenkinsUpdateInterval != jenkinsUpdateInterval || lastJenkinsTimeOut != jenkinsTimeOut) {
                lastJenkinsUpdateInterval = jenkinsUpdateInterval;
                lastJenkinsTimeOut = jenkinsTimeOut;
				clearTimeout(updateTimeout);
				setTimeout(update, jenkinsUpdateInterval);
            }

            if (lastPaintInterval != paintInterval) {
                lastPaintInterval = paintInterval;
				clearTimeout(updateTimeout);
				setTimeout(update, jenkinsUpdateInterval);
            }

            if (theme && lastTheme && lastTheme != theme) {
				$("body").addClass(theme);

				if(themes[lastTheme] && typeof themes[lastTheme].stop === 'function'){
					themes[lastTheme].stop();
				}

				if(themes[theme] && typeof themes[theme].start === 'function'){
					themes[theme].start();
				}

                lastTheme = theme;
            }

            if (customTheme)
            {
				$("#customThemeStyling").remove();
                $("head").append("<style id='customThemeStyling' type=\"text/css\">" + customTheme + "</style>");
            }


            if (fontFamily && lastFontFamily != fontFamily) {
                $("body").css({
                    'font-family': fontFamily
                });
                lastFontFamily = fontFamily;
            }

        },
        error: function(e, xhr){
            debug("error getting plugin api: '" + e.statusText + "'");
            updateRunning["pluginconfiguration"] = false;
        },
        timeout: jenkinsTimeOut
    });
}
