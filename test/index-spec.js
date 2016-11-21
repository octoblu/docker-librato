describe('when required', function() {
  it('should not blow up', function() {
    expect(() => {
      require('../')
    }).to.not.Throw
  })
})
