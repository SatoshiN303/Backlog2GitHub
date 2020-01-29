'use strict'

/**
 * GithubAPI 
 * @constructor
 */
class GithubService {

    /** 
     * @param {GithubClient} client 
     */
    constructor(client) {
        this.client = client
    }

    /**
     * Automatically paginate and load all issues in a single repository
     * @link https://octokit.github.io/rest.js/#octokit-routes-issues-list-for-repo
     * @link https://github.com/octokit/rest.js/issues/688
     * @param {String} owner - レポジトリオーナー
     * @param {String} repository - レポジトリ名
     * @param {String} createdSince - 取得開始年月日 YYYY-MM-DDTHH:MM:SSZ
     */
    async getIssueTitles(owner, repository, createdSince) {
        let options = {}
        options.owner = owner
        options.repo = repository
        options.state = 'all'
        options.since = createdSince
        const issues = await this.client.issues.listForRepo(options)
        const issueTitles = await this.client.paginate(issues, ({ data }) => data.map(issue => issue.title))
        return issueTitles
    }
    
    /**
     * Create an issue
     * @link https://octokit.github.io/rest.js/#octokit-routes-issues-create
     * @param {String} owner 
     * @param {String} repository 
     * @param {String} title 
     * @param {Object} body 
     */
    async createIssues(owner, repository, title, body) {
        let options = {}
        options.owner = owner
        options.repo = repository
        options.title = title
        options.body = body
        return await this.client.issues.create(options)
    }   
}

module.exports = GithubService;