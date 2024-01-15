// Copyright (c) 2024 SURE.social All Rights Reserved.

process.on ( 'uncaughtException', function ( err ) {
    console.log ( err );
    process.exit ( 1 );
});

import assert           from 'assert';
import bodyParser       from 'body-parser';
import express          from 'express';
import fetch            from 'cross-fetch';
import njwt             from 'njwt';
import sodium           from 'libsodium-wrappers';

const PORT                      = 7777;
const JWT_SIGNING_KEY           = '2d4a51b5697b93bd3d2caca648e77ebf9d6835da34411f7ca49d54bd5211e48c';
const JWT_EXPIREATION_SECS      = 15 * 60; // 15 minutes
const CLAIM_TYPE                = 'over18';

//----------------------------------------------------------------//
// Here's the entrypoint and server setup.
( async () => {

    // We have to wait for sodium to initialie before using it.
    await sodium.ready;

    const server = express ();

    server.use ( function ( req, res, next ) {
        res.header ( 'Access-Control-Allow-Origin', '*' );
        res.header ( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
        res.header ( 'Access-Control-Allow-Methods', 'GET, OPTIONS, POST' );
        next ();
    });

    server.use ( bodyParser.json ());

    server.get ( '/challenge', getChallengeAsync ); // generate a challenge string
    server.post ( '/claim', postClaimAsync ); // verify a claim

    await server.listen ( PORT );
    console.log ( 'LISTENING ON PORT:', PORT );

})();

//----------------------------------------------------------------//
async function getChallengeAsync ( request, response ) {

    // Generate a short, random string for the nonce.
    const nonce = sodium.to_hex ( sodium.randombytes_buf ( 8 ));
    response.json ({

        // The challenge string is just the claim type prepended to the nonce.
        challenge: `${ CLAIM_TYPE }.${ nonce }`,

        // Also create a JWT containing the nonce. We can use this to check that
        // challenge strings originated from this server and also to expire them.
        // This token is just for us; it never gets sent to SURE.social.
        token: createJWT ({ nonce: nonce }, JWT_SIGNING_KEY ),
    });
}

//----------------------------------------------------------------//
async function postClaimAsync ( request, response ) {

    try {

        // This is the token we generated earlier.
        const token = request.body.token;

        // The is claim the user retriened from SURE.social.
        const claimString = request.body.claim;

        assert ( token && claimString ); // Make sure we have both.

        const jwtClaims = verifyJWT ( token, JWT_SIGNING_KEY );

        assert ( jwtClaims ); // Make sure the JWT is valid.
        assert ( jwtClaims.nonce ); // The JWT should have a nonce.

        // Split the claim components.
        const claimComponents = claimString.split ( '.' );
        assert ( claimComponents.length === 5 ); // There should always be five.

        const claim = {
            type:           claimComponents [ 0 ], // The type of claim requested ('over18' or 'over21').
            nonce:          claimComponents [ 1 ], // The nonce we generated earlier.
            salt:           claimComponents [ 2 ], // The salt used to hash the nonce.
            keyName:        claimComponents [ 3 ], // The name of the key used for signing.
            signature:      claimComponents [ 4 ], // The signed response from SURE.social.
        }

        // All the components should be non-empty.
        assert ( claim.type );
        assert ( claim.nonce );
        assert ( claim.salt );
        assert ( claim.keyName );
        assert ( claim.signature );

        // The nonce returned by the user should match the nonce we generated.
        assert ( claim.nonce === jwtClaims.nonce );

        // Fetch the public key frpm SURE.social.
        const keyResult = await ( await fetch ( `https://api.sure.social/sig/keys/${ claim.keyName }` )).json ();

        // There be a valid public key for the claim. SURE.social used the corresponding private key to sign.
        assert ( keyResult.key.publicKey );

        // Remember, SURE.social is never send the nonce we generate. Instead, that nonce is hashed
        // with a randomly generated salt. The salt is generated on the users client and isn't sent
        // to SURE.social, either. Only the has of the nonce and the salt are sent, along with the
        // type of claim being requested.

        // To verify the signature, we'll need to recreate what was sent to SURE.social to sign.

        // First, we hash the nonce and the salt.
        const hash = hashSD ( `${ claim.nonce }${ claim.salt }` );

        // Next, we recreate the message.
        const message = `${ claim.type }.${ hash }`;

        // Now we check the signature, which returns the exact string SURE.social signed.
        const verified = verifySD ( claim.signature, keyResult.key.publicKey, 'utf8' );

        // At this stage, we know the message we expected to be signed, and we know the message
        // that actually was signed. If these two messages match, we're in the clear.

        assert ( verified === message );

        response.json ({
            type:           claim.type,
        });
        return;
    }
    catch ( error ) {
        console.log ( error );
    }
    response.status ( 400 ).send ();
}

//================================================================//
// JWT
//================================================================//

//----------------------------------------------------------------//
function createJWT ( claims, signingKeyHex ) {

    const signingKey = Buffer.from ( signingKeyHex, 'hex' );

    try {
        const jwt = njwt.create ( claims, signingKey );
        jwt.setExpiration ( new Date ().getTime () + ( JWT_EXPIREATION_SECS * 1000 )); // expire in 15 minutes
        return jwt.compact ();
    }
    catch ( error ) {
        console.log ( error );
    }
}

//----------------------------------------------------------------//
function verifyJWT ( jwt64, signingKeyHex ) {

    if ( !( jwt64 && ( typeof ( jwt64 ) === 'string' ))) return false;

    const signingKey = Buffer.from ( signingKeyHex, 'hex' );

    try {
        return njwt.verify ( jwt64, signingKey ).body || false;
    }
    catch ( error ) {
        console.log ( error );
        return false;
    }
}


//================================================================//
// sodium
//================================================================//

//----------------------------------------------------------------//
function hashSD ( plaintext ) {

    plaintext = sodium.from_string ( plaintext );
    return sodium.to_hex ( sodium.crypto_generichash ( sodium.crypto_generichash_BYTES_MAX, plaintext ));
}

//----------------------------------------------------------------//
function verifySD ( ciphertext, publicKey ) {

    const plaintext = sodium.crypto_sign_open (
        sodium.from_hex ( ciphertext ),
        sodium.from_hex ( publicKey )
    );

    return plaintext ? sodium.to_string ( plaintext ) : false;
}
