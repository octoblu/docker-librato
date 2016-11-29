process.env.LIBRATO_EMAIL='test@test.com'
process.env.LIBRATO_TOKEN='test'
process.env.CLUSTER_NAME='cluster-name'

require('../index.js')

describe('when required', function() {
  it('should not blow up', function() {
    expect(true).to.be.true
  })
})
