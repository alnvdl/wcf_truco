function average(data) {
    if (data.length === 0) {
        return 0;
    }
    let sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
}

function popStdev(data) {
    if (data.length === 0) {
        return 0;
    }

    let avg = average(data);
    let deviations = data.map(x => Math.pow(x - avg, 2));
    let variance = average(deviations);
    return Math.sqrt(variance);
}

module.exports = function(Application) {
    return class PlanningTruco extends Application {
        constructor() {
            super("truco", "Serious business story estimation");
            this.registerCommand("start",
                this.start,
                "Start a planning truco hosted by you");
            this.registerCommand("end",
                this.end,
                "End a planning truco being hosted by you");
            this.registerCommand("status",
                this.status,
                "Show the current status of the planning truco session");
            this.registerCommand("session",
                this.sessionStatus,
                "Show the full status of the current planning truco session");
            this.registerCommand("join",
                this.status,
                "Show the status of your participation in planning truco sessions");
            this.registerCommand("join [who]",
                this.join,
                "Join a planning truco being hosted by someone ([who])");
            this.registerCommand("leave",
                this.leave_list,
                "Show planning trucos you're currently participating in");
            this.registerCommand("leave [who]",
                this.leave,
                "Leave a planning truco being hosted by someone ([who])");
            this.registerCommand("reset",
                this.set,
                "reset the current story and set it up for re-estimation");
            this.registerCommand("set [story]",
                this.set,
                "set a [story] for estimation");
            this.registerCommand("estimate [score]",
                this.estimate,
                "estime the current [story] as having size [score]; use 0 to clear you vote, or ? to indicate doubt");
            this.registerCommand("history",
                this.history,
                "Show all previous planning trucos");
            this.registerCommand("pause",
                this.pause,
                "Stops the session and calculates estimation stats for the current story; call estimate again to resume");
        }

        getSessionString(session, indentLevel = 0) {
            let out = "";

            out += `Host: ${session.host}\n`
            out += `started at ${(new Date(session.startDate)).toLocaleString()}\n`;
            if (session.endDate) {
                out += `ended at ${(new Date(session.endDate)).toLocaleString()}\n`;
            }
            out += `Participants: ${session.participants.join(", ")}\n`
            out += `${Object.keys(session.stories).length === 0 ? "No stories were estimated." : "Stories:"}\n`

            Object.keys(session.stories).forEach(story => {
                out += this.getStoryEstimationString(story, session.stories[story].estimations, true);
                out += "\n";
            });

            let indentStr = "    ".repeat(indentLevel);
            if (indentLevel) {
                out = out.replace(/\n/g, "\n" + indentStr)
            }

            return indentStr + out.trim();
        }

        getStoryEstimationString(story, estimations, withTitle) {
            let out = "";
            if (withTitle) {
                out += `'${story}':\n    `
            }
            out += `${Object.keys(estimations).length === 0 ? "No estimations were made." : "Estimations:"}\n`;
            let estimates = [];
            Object.entries(estimations).forEach(([user, estimation]) => {
                if (withTitle) {
                    out += `    `;
                }
                out += `    ${user}: ${estimation}\n`;
                if (estimation !== "?") {
                    estimates.push(estimation);
                }
            });
            if (withTitle) {
                out += `    `
            }
            if (Object.entries(estimations).length > 0) {
                out += `min/avg/max/stdev: ${Math.min(...estimates)}/${average(estimates)}/${Math.max(...estimates)}/${popStdev(estimates)}\n`;
            }
            return out.trim();
        }

        getSessionStatusString(session) {
            let story = session.stories[session.currentStory];
            var out = "";
            if (!story) {
                out += `No story defined for estimation yet.`;
            } else {
                if (story.estimating) {
                    out += `People are now estimating '${session.currentStory}'\n`;
                    let estimated = Object.keys(story.estimations);
                    let waiting = [];
                    session.participants.forEach(user => {
                        if (!estimated.includes(user)) {
                            waiting.push(user);
                        }
                    });
                    out += `    Estimated: ${estimated.join(", ") || "-"}\n`;
                    out += `    Waiting for: ${waiting.join(", ") || "-"}\n`;
                    if (waiting.length = 0) {
                        out += `Ready to discuss!`;
                    }
                } else {
                    out += `People should now discuss estimations for story '${session.currentStory}'.\n`;
                    out += this.getStoryEstimationString(session.currentStory, story.estimations, false);
                }
            }
            return out;
        }

        async status(ctx) {
            var sessions = await ctx.getData("sessions", {});

            if (Object.keys(sessions).length == 0) {
                return new Application.Response("There are currently no planning trucos being hosted");
            }

            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            let session = this.getSessionForUser(sessions, user);
            var out = "You are not currently part of any planning trucos.";
            if (session) {
                out = `You are part of the planning truco hosted by '${session.host}'.\n`;
                out += this.getSessionStatusString(session);
            } else {
                out = `Planning sessions are being hosted by the following users: ${Object.keys(sessions).map(x => `'${x}'`).join(", ")}.\n`;
            }
            return new Application.Response(out.trim());
        }

        async sessionStatus(ctx) {
            var sessions = await ctx.getData("sessions", {});

            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            let session = this.getSessionForUser(sessions, user);
            var out = "You are not currently part of any planning trucos.";
            if (session) {
                out = `You are part of the planning truco hosted by '${session.host}'.\n`;
                out += this.getSessionString(session);
            }
            return new Application.Response(out.trim());
        }

        async start(ctx) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx)
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});
            if (user in sessions) {
                return new Application.ErrorResponse("You already have a planning truco under your name. Please end it first.");
            }
            sessions[user] = {
                startDate: new Date(),
                host: user,
                participants: [user],
                stories: {},
                currentStory: null,
            }
            await ctx.setData("sessions", sessions);
            ctx.deleteClientData("reallyEnd");
            return new Application.Response(`Session started!\n` +
                `Tell people in your truco to login and run the 'truco join ${user}' command.`);
        }

        async leave_list(ctx) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});

            var mySessions = Object.keys(sessions).filter(session => {
                return sessions[session].participants.includes(user);
            });

            if (mySessions.length == 0) {
                return new Application.Response("You are not currently part of any planning trucos");
            }

            var out = "planning trucos you are currently a part of:\n";
            mySessions.forEach(session => {
                let startDate = new Date(sessions[session].startDate);
                out += `    ${session}: started at ${startDate.toLocaleString()}\n`;
            });
            return new Application.Response(out.trim());
        }

        async join(ctx, who) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();
            let host = await this.getApplicationUtils("login").getUser(ctx, who);
            if (!host) return this.getApplicationUtils("login").userDoesNotExit();

            if (user === host) {
                return new Application.ErrorResponse(`You don't need to join your own planning truco.`);
            }
            var sessions = await ctx.getData("sessions", {});
            var session = sessions[host];
            if (!session) {
                return new Application.ErrorResponse(`User ${host} is not currently hosting a planning truco.`);
            }
            let userSession = this.getSessionForUser(sessions, user);
            if (userSession) {
                return new Application.ErrorResponse(`You are already in a planning truco hosted by '${userSession.host}'.`);
            }

            session.participants.push(user);
            await ctx.setData("sessions", sessions);

            return new Application.Response(`You joined the planning truco hosted by ${host}!`);
        }

        async leave(ctx, who) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();
            let host = await this.getApplicationUtils("login").getUser(ctx, who);
            if (!host) return this.getApplicationUtils("login").userDoesNotExit();

            if (user === host) {
                return new Application.ErrorResponse(`You cannot leave your own planning truco, end it instead`);
            }
            var sessions = await ctx.getData("sessions", {});
            var session = sessions[host];
            if (!session) {
                return new Application.ErrorResponse(`User ${host} is not currently hosting a planning truco`);
            }
            if (!session.participants.includes(user)) {
                return new Application.ErrorResponse(`You are not part of the planning truco hosted by ${host}`);
            }
            session.participants.splice(session.participants.indexOf(user), 1);
            await ctx.setData("sessions", sessions);

            return new Application.Response(`You left the planning truco hosted by ${host}!`);
        }

        async end(ctx) {
            let host = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!host) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});
            var session = sessions[host];
            if (!session) {
                return new Application.ErrorResponse(`You are not currently hosting a planning truco`);
            }

            if (!ctx.getClientData("reallyEnd")) {
                ctx.setClientData("reallyEnd", true);
                return new Application.Response(`After you end a section, it will be added to the history.\n` +
                    `Warning: ending a session is an irreversible action.\n` +
                    `To really end this session, please confirm the details below run the 'truco end' command again:\n` +
                    this.getSessionString(session, 1));
            } else {
                ctx.deleteClientData("reallyEnd");

                var history = await ctx.getData("history", []);
                session.endDate = new Date();
                history.push(session);
                delete sessions[host];

                await ctx.setData("sessions", sessions);
                await ctx.setData("history", history);

                return new Application.Response(`Session ended!\n` +
                    `This is the session as it has been logged to the history:\n` +
                    this.getSessionString(session, 1));
            }
        }

        async set(ctx, story) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});
            var session = this.getSessionForHost(sessions, user);
            if (!session) {
                return new Application.ErrorResponse(`You are not currently hosting a planning truco`);
            }

            if (!story && !session.currentStory) {
                return new Application.ErrorResponse(`You must define a story to be estimated.`);
            }

            if (!story && session.currentStory) {
                story = session.currentStory;
            }

            session.stories[story] = {
                estimations: {},
                estimating: true,
            };
            session.currentStory = story;

            await ctx.setData("sessions", sessions);
            return new Application.Response(`The current story is now '${story}'. Ask people to estimate it with 'truco estimate [score]'.`);
        }

        getSessionForHost(sessions, user) {
            return sessions[user];
        }

        getSessionForUser(sessions, user) {
            let session = null;
            Object.values(sessions).forEach(s => {
                if (s.participants.includes(user)) {
                    session = s;
                }
            });
            return session;
        }

        async estimate(ctx, score) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});
            let session = this.getSessionForUser(sessions, user);
            if (!session) {
                return new Application.ErrorResponse(`You must be a part of a planning truco to estimate a story.`);
            }

            if (session.currentStory && !session.stories[session.currentStory].estimating) {
                return new Application.ErrorResponse(`Now is not the time to estimate the story, behave yourself!`);
            }

            let what = "";
            if (score === "?") {
                session.stories[session.currentStory].estimations[user] = score;
                what = `You expressed doubts about the estimation for story '${session.currentStory}'`;
            } else if (score.toLowerCase() === "x") {
                delete session.stories[session.currentStory].estimations[user];
                what = `You removed your estimated for '${session.currentStory}'`;
            } else {
                let scoreError = new Application.ErrorResponse("Invalid score. The score must be:\n" +
                    "- a valid positive integer number (0, 1, 2, 3, 5, 8, 13, 20, 40, 100);\n" +
                    "- a '?' to indicate doubt;\n" +
                    "- an 'X' to clear your vote.");

                try {
                    score = parseInt(score);
                } catch (e) {
                    return scoreError;
                }
                if (![0, 1, 2, 3, 5, 8, 13, 20, 40, 100].includes(score)) {
                    return scoreError;
                }
                session.stories[session.currentStory].estimations[user] = score;
                what = `You estimated story '${session.currentStory}' as ${score}`;
            }

            await ctx.setData("sessions", sessions);
            return new Application.Response(`${what}; run estimate again to change it.`);
        }

        async history(ctx) {
            let history = await ctx.getData("history", []);
            if (history.length == 0) {
                return new Application.Response("There is no planning truco history.", history);
            }
            let out = "Previous planning trucos (at most 5 are shown):\n";
            history.slice(-5).forEach(session => {
                out += this.getSessionString(session, 1) + "\n\n";
            });
            return new Application.Response(out.trim(), history);
        }

        async pause(ctx) {
            let user = await this.getApplicationUtils("login").getLoggedInUser(ctx);
            if (!user) return this.getApplicationUtils("login").notLoggedIn();

            var sessions = await ctx.getData("sessions", {});
            var session = this.getSessionForHost(sessions, user);
            if (!session) {
                return new Application.ErrorResponse(`You are not currently hosting a planning truco`);
            }

            if (!session.currentStory) {
                return new Application.ErrorResponse(`No stories are being estimated at the moment in this session`);
            }

            session.stories[session.currentStory].estimating = false;;
            await ctx.setData("sessions", sessions);

            let out = this.getSessionStatusString(session);
            return new Application.Response(`Estimations on story '${session.currentStory}' have been paused.\n${out.trim()}`);
        }
    }
}
