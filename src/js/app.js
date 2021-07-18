/* global customElements, CustomEvent, ethers  */

import { BuyRandom } from './components/BuyRandom.js'
import { MetaMaskIdentity } from './components/MetaMaskIdentity.js'
import { NFTListing } from './components/NFTListing.js'

import { onWindowEthereum } from './utils.js'

const CONTRACT_ADDRESS = document.querySelector('meta[name="contract-address"]').content
const ABI = JSON.parse(document.querySelector('#abi').innerText)

if (window.location.hash === '') { window.location.hash = 'available' }
document.body.addEventListener('change', function (e) { window.location.hash = e.target.value })

window.addEventListener('hashchange', (function updateNFTList () {
  const hash = window.location.hash.substr(1)
  const nftList = document.querySelector('#nfts')
  nftList.classList.remove('yours', 'available', 'all')
  nftList.classList.add(hash)
  return updateNFTList
})())

onWindowEthereum(async (e) => {
  if (window.ethereum) {
    document.querySelectorAll('.metamask').forEach(e => { e.classList.remove('metamask') })
  }

  customElements.define('buy-random', BuyRandom)
  customElements.define('metamask-identity', MetaMaskIdentity)
  customElements.define('nft-listing', NFTListing)

  setInterval((function sendEvents () {
    const provider = new ethers.providers.Web3Provider(window.ethereum)

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
    const filter = contract.filters.Transfer()
    contract.queryFilter(filter).then(events => {
      const transfersEvent = new CustomEvent('transfers', { detail: events })
      document.dispatchEvent(transfersEvent)
    })
  })(), 5000)

  setInterval((function updateCounts () {
    const all = document.querySelectorAll('nft-listing').length
    const owned = document.querySelectorAll('nft-listing[owner]').length
    const yours = document.querySelectorAll('nft-listing[yours]').length

    document.querySelectorAll('var.all').forEach(e => { e.innerText = all })
    document.querySelector('var.available').innerText = all - owned
    document.querySelector('var.yours').innerText = yours

    return updateCounts
  })(), 1000)
})
