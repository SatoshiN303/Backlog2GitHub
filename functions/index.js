const functions = require('firebase-functions')
const cors = require('cors')({ origin: true })
const compression = require('compression')()
global.fetch = require('node-fetch')

const ConfigModule = require('./modules/config-module')
const configModule = new ConfigModule(functions.config())
const config = configModule.getAll()

const owner = config.github.owner
const repos = [config.github.spn, config.github.cvs, config.github.seven, config.github.hdk]

function makeBacklogClient() {
	const host = config.backlog.host
	const apiKey = config.backlog.apikey
	const backlogjs = require('backlog-js')
	return new backlogjs.Backlog({ host, apiKey })
}

function makeGithubClient() {
	const personalAccessToken = config.github.personal_token
	const octokit = require("@octokit/rest")
	const githubClient = new octokit({ auth: personalAccessToken })
	const GithubService = require('./modules/github-service')
	return new GithubService(githubClient)
}

function ninetyDaysAgo() {
	var date = new Date()
	date.setDate(date.getDate() - 90);
	var year = date.getFullYear()
	var month = ("00" + (date.getMonth() + 1)).slice(-2)
	var day = ("00" + date.getDate()).slice(-2)
	return year + "-" + month + "-" + day
}

async function backlogTicket(backlog) {
	const backlogStatusIDs = [1, 2]
	const backlogAssigneeId = [Number(config.backlog.assignee_id)]
	const backlogFetchCount = 100

	const spn = [Number(config.backlog.projectid_spn_debug), Number(config.backlog.projectid_spn_allseason), Number(config.backlog.projectid_spn_nenga)]
	const cvs = [Number(config.backlog.projectid_cvs)]
	const seven = [Number(config.backlog.projectid_seven)]
	const hdk = [Number(config.backlog.projectid_hdk_debug), Number(config.backlog.projectid_hdk_allseason), Number(config.backlog.projectid_hdk_nenga)]
	let projectIDs = [spn, cvs, seven, hdk]

	let options = {}
	options.statusId = backlogStatusIDs
	options.assigneeId = backlogAssigneeId
	options.count = backlogFetchCount
	options.createdSince = ninetyDaysAgo()

	var tickets = await Promise.all(projectIDs.map(async (ids) => {
		options.projectId = ids
		const titles = await backlog.getIssues(options)
		return titles
	}))
	return tickets
}

async function githubTitles(github) {
	var titles = await Promise.all(repos.map(async (value) => {
		const titles = await github.getIssueTitles(owner, value, ninetyDaysAgo())
		return titles
	}))
	return titles
}

async function postSlack(message) {
	const webhookURL = config.slack.incoming_webhook
	const request = require("request-promise")
	return await request({
		uri: webhookURL,
		method: "POST",
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			attachments: [{
				fallback: 'Required plain-text summary of the attachment.',
				color: '#7CD197',
				pretext: '',
				title: 'GitHub Issues追加🐙🐱',
				text: message,
			}],
			link_names: 1 // @がメンションと解釈されるためのフラグ
		})
	})
}


async function crawl(titles, tickets, repository, github) {
	return Promise.all(tickets.map(async (ticket) => {
		// Backlogチケット.issueKeyが Github.issues.titlesの中に含まれてなければ 追加する。
		if (!titles.some(title => (title.indexOf(ticket.issueKey) !== -1))) {
			var title = ticket.issueKey + ' ' + ticket.summary
			var body = '## 該当するBacklogのチケットURL\nhttps://insertbackloghost/view/' + ticket.issueKey
			var soko = await github.createIssues(owner, repository, title, body)
			var doko = await postSlack(title + ' が追加されました。担当者をアサインしてください👨🏻‍💻')
			return title + 'を追加しました。'
		} else {
			return ''
		}
	}))
}

async function main() {
	const github = makeGithubClient()
	const backlog = makeBacklogClient()
	const titles = await githubTitles(github)
	const tickets = await backlogTicket(backlog)
	return Promise.all(repos.map(async (repository, idx) => {
		var result = await crawl(titles[idx], tickets[idx], repository, github)
		return result
	}))
}

// Run every 3 hours from 9:00 to 19:00 from Monday to Friday
exports.cron = functions.pubsub.schedule('0 9-19/3 * * 1-5') 
	.timeZone('Asia/Tokyo')
	.onRun((context) => {
		console.log("cron実行");
		// eslint-disable-next-line promise/always-return
		main().then(data => {
			console.log(data)
		}).catch(err => {
			console.log(err)
		})
		return 0 //Function returned undefined, expected Promise or value 防止
	});

// Operation check script on web browser
// exports.backlog2github = functions.https.onRequest((request, response) => {
// 	cors(request, response, () => {
// 		compression(request, response, () => {
// 			// eslint-disable-next-line promise/always-return
// 			main().then(data => {
// 				response.send(data)
// 			}).catch(err => {
// 				response.status(500).json(err)
// 			})
// 		})
// 	})
// })