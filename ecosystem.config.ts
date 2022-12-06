export default {
    apps: [
        {
            name: 'ltrekstrapi',
            cwd: '/home/ubuntu/project/LtrekStrapi',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production'
            },
        },
    ],
};