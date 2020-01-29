'use strict'

/**
 * Firebase設定 取得モジュール
 * @constructor
 */

 class ConfigModule {
 	constructor(config) {
 		this.config = config
 	} 

 	get(key, defaultValue = null) {
 		if (key in this.config) {
 			return this.config[key]
 		} else {
 			return defaultValue
 		}
 	}

 	getAll() {
 		return this.config
 	}

 }
 
 module.exports = ConfigModule