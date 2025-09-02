if (require('node:worker_threads').isMainThread)
    return module.exports = { hidden: true }

//Failing here Lord ID not properly aqquired
//This thing is gonna give you a stroke...

const { xtHandler, sendXT, waitForResult } = require("../ggebot")
const playerid = require("./playerid.js")

// Polyfill para Promise.withResolvers si no existe
if (!Promise.withResolvers) {
    Promise.withResolvers = function() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

const event = new EventTarget()

let gamResolverHasResolved = false
let gamResolver = Promise.withResolvers()
let gliResolverHasResolved = false
let gliResolver = Promise.withResolvers()

let commanders = gliResolver.promise //SAME AS THIS
let usedCommanders = gamResolver.promise //THIS MUST BE RESOLVED 

async function freeCommander(LID) {
    if (LID == undefined)
        return
    let index = (await usedCommanders).findIndex(e => e == LID)
    if (index == -1)
        return

    (await usedCommanders).splice(index, 1)
    event.dispatchEvent(new CustomEvent('freedCommander', { detail: LID }))
}
async function useCommander(LID) {
    let usedCommandersR = await usedCommanders

    if (LID != undefined && !usedCommandersR.includes(LID))
        usedCommandersR.push(LID)
    return LID
}
const waitForCommanderAvailable = (arr) => new Promise(async resolve => {
    let usedCommandersR = await usedCommanders
    let commandersR = await commanders

    let LID = commandersR.find(e => (!arr || arr.includes(e.VIS)) && !usedCommandersR.includes(e.ID))?.ID
    if (LID != undefined) {
        return resolve(useCommander(LID))
    }

    let checkForCommander = async (currentEvent) => {
        currentEvent.stopPropagation()
        event.removeEventListener("freedCommander", checkForCommander)
        if(!arr || arr.includes(commandersR.find(e=> e.ID == currentEvent.detail).VIS))
            return resolve(useCommander(currentEvent.detail))
    }
    event.addEventListener("freedCommander", checkForCommander)
})

xtHandler.on("lli", async (_, result) => {
    if (result != 0)
        return

    let parseGLI = (gli) => {
        //I don't like
        //Need to change the resolved objects inner items instead of itself
        if (gliResolverHasResolved) {
            commanders = Promise.resolve(gli) 
            return
        }
        gliResolverHasResolved = true
        gliResolver.resolve(gli)
    }

    xtHandler.on("aci", (obj, r) => !r ? parseGLI(obj.gli.C) : void 0)
    xtHandler.on("adi", (obj, r) => !r ? parseGLI(obj.gli.C) : void 0)
    xtHandler.on("gli", (obj, r) => !r ? parseGLI(obj.C) : void 0)

    xtHandler.on("cat", async (obj) => {
        if (obj.A.M.TA[4] != await playerid)
            return

        useCommander(obj?.A?.UM?.L?.ID)
        setTimeout(() => freeCommander(obj?.A?.UM?.L?.ID), (obj.A.M.TT - obj.A.M.PT + 1) * 1000).unref()
    })
    let usedCommanders = []
    xtHandler.on("gam", async (obj) => {
        let useCommander = (LID) => {
            if (LID != undefined && !usedCommanders.includes(LID))
                usedCommanders.push(LID)
            return LID
        }

        for (let i = 0; i < obj.M.length; i++) {
            const o = obj.M[i];
            if (o.M.SA[4] != await playerid)
                continue
            useCommander(o?.UM?.L?.ID)
        }
        for (let i = 0; i < obj.M.length; i++) {
            const o = obj.M[i];
            if (o.M.TA[4] != await playerid)
                continue
            if (o.M.T != 2)
                continue

            useCommander(o?.UM?.L?.ID)
            setTimeout(() => freeCommander(o.UM?.L?.ID),
                (o.M.TT - o.M.PT + 1) * 1000).unref()

        }

        if (gamResolverHasResolved) {
            usedCommanders.forEach(async LID => {
                await useCommander(LID)
            })
            return
        }
        gamResolverHasResolved = true
        gamResolver.resolve(usedCommanders)
    })

    sendXT("gli", JSON.stringify({}))
})


module.exports = {
    waitForCommanderAvailable,
    useCommander,
    freeCommander
}