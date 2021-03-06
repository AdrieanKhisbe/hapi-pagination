'use strict';

const _    = require('lodash');
const Boom = require('boom');
const Hoek = require('hoek');
const Qs   = require('qs');

module.exports = function (config) {
    return {
        onPreHandler: function (request, reply) {

            const include = config.routes.include;
            const exclude = config.routes.exclude;
            const path = request.route.path;


            // If the route does not match, just skip this part
            if (request.route.method === 'get' && (include[0] === '*' || _.includes(include, path)) &&
                !_.includes(exclude, path)) {

                let pagination = request.query[config.query.pagination.name];

                if (pagination === 'false') {
                    pagination = false;
                } else if (pagination === 'true') {
                    pagination = true;
                } else {
                    pagination = config.query.pagination.default;
                }

                request.query[config.query.pagination.name] = pagination;

                if (pagination === false) {
                    return reply.continue();
                }


                let page = config.query.page.default;
                let limit = config.query.limit.default;

                const checkRoute = v => {
                    let match = _.includes(v.routes, request.route.path);
                    if (match) {
                        page = v.page;
                        limit = v.limit;
                    }

                    return !match;
                };

                _.every(config.routes.override, checkRoute);


                if (_.has(request.query, config.query.page.name)) {
                    const temp = _.parseInt(request.query[config.query.page.name]);
                    if (_.isNaN(temp)) {
                        if (config.query.invalid === 'defaults') {
                            page = config.query.page.default;
                        } else {
                            return reply(Boom.badRequest('Invalid page'));
                        }

                    } else {
                        page = temp;
                    }
                }

                if (_.has(request.query, config.query.limit.name)) {
                    const temp = _.parseInt(request.query[config.query.limit.name]);
                    if (_.isNaN(temp)) {
                        if (config.query.invalid === 'defaults') {
                            limit = config.query.limit.default;
                        } else {
                            return reply(Boom.badRequest('Invalid limit'));
                        }
                    } else {
                        limit = temp;
                    }
                }

                request.query[config.query.page.name] = page;
                request.query[config.query.limit.name] = limit;
            }

            return reply.continue();
        },




        onPreResponse: function (request, reply) {

            if (request.response.isBoom || request.route.method !== 'get') {
                return reply.continue();
            }


            const include = config.routes.include;
            const exclude = config.routes.exclude;
            const path = request.route.path;


            if ((include[0] === '*' || _.includes(include, path)) &&
                !_.includes(exclude, path)) {

                if (request.query[config.query.pagination.name] === false) {
                    return reply.continue();
                }

                delete request.query[config.query.pagination.name];


                const temp = request.response.source;

                const results = Array.isArray(temp) ? request.response.source : request.response.source.results;
                Hoek.assert(Array.isArray(results), 'The results must be an array');
                const totalCount = request.response.source.totalCount || request[config.meta.totalCount.name];

                const baseUrl = config.uri + request.url.pathname + '?';
                const qs = request.query;
                const qsPage = qs[config.query.page.name];

                const meta = {};

                const getPageCount = function () {
                    return Math.trunc(totalCount / qs[config.query.limit.name]) +
                         ((totalCount % qs[config.query.limit.name] === 0) ? 0 : 1);
                };

                if (config.meta.page.active) {
                    meta[config.query.page.name] = qs[config.query.page.name];
                }

                if (config.meta.limit.active) {
                    meta[config.query.limit.name] = qs[config.query.limit.name];
                }

                if (config.meta.count.active) {
                    meta[config.meta.count.name] = results.length;
                }

                if (config.meta.totalCount.active) {
                    meta[config.meta.totalCount.name] = totalCount || null;
                }

                if (config.meta.pageCount.active) {
                    let pageCount = null;

                    if (totalCount) {
                        pageCount = getPageCount();
                    }

                    meta[config.meta.pageCount.name] = pageCount;
                }

                if (config.meta.self.active) {
                    meta[config.meta.self.name] = baseUrl + Qs.stringify(qs);
                }

                const getUrl = function (page) {
                    const override = {};
                    override[config.query.page.name] = page;

                    return baseUrl + Qs.stringify(Hoek.applyToDefaults(qs, override));
                };

                if (config.meta.previous.active) {
                    let url = null;
                    if (qsPage !== 1) {
                        url = getUrl(qsPage - 1);
                    }

                    meta[config.meta.previous.name] = url;
                }

                if (config.meta.next.active) {
                    let url = null;

                    if (totalCount) {
                        const pageCount = getPageCount();

                        if (qsPage < pageCount) {
                            url = getUrl(qsPage + 1);
                        }
                    }

                    meta[config.meta.next.name] = url;
                }

                if (config.meta.first.active) {
                    meta[config.meta.first.name] = getUrl(1);
                }

                if (config.meta.last.active) {
                    let url = null;

                    if (totalCount) {
                        url = getUrl(getPageCount());
                    }

                    meta[config.meta.last.name] = url;
                }


                const response = {};
                response[config.meta.name] = meta;
                response[config.results.name] = results;
                request.response.source = response;

            }

            return reply.continue();

        }


    };
};
