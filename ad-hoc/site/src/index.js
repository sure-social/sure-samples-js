// Copyright (c) 2024 SURE.social All Rights Reserved.

import'./index.css';

import registerServiceWorker    from './util/registerServiceWorker';
import React                    from 'react';
import ReactDOM                 from 'react-dom/client';

const SERVICE_URL = 'http://localhost:7777';

//----------------------------------------------------------------//
const App = () => {

    const [ challenge, setChallenge ]               = React.useState ( '' );
    const [ challengeToken, setChallengeToken ]     = React.useState ( '' );
    const [ claim, setClaim ]                       = React.useState ( '' );
    const [ status, setStatus ]                     = React.useState ( 'none' );

    const getChallengeAsync = async () => {

        const response = await ( await fetch ( `${ SERVICE_URL }/challenge` )).json ();
        
        // This is the challenge string we disply to the user.
        setChallenge ( response.challenge );

        // This is a JWT token we'll store and return to verify that the challenge
        // string is the one that we created, and to cause it to expire
        // after a short time.
        setChallengeToken ( response.token );
    }

    // Run getChallengeAsync () once to get a fresh challenge string on page load.
    React.useEffect (() => { getChallengeAsync (); }, []);

    const onSubmit = async () => {

        if ( !claim ) return;

        try {
            const response = await ( await fetch (
                `${ SERVICE_URL }/claim/`, {
                    method:     'POST',
                    headers:    {[ 'content-type' ]: 'application/json' },
                    body: JSON.stringify ({
                        token:      challengeToken,
                        claim:      claim,
                    })
                }
            )).json ();
            

            // If the verification succeeds, our server will return the
            // claim type ('over18' or 'over21').
            setStatus ( response.type );
        }
        catch ( error ) {
            console.log ( error );
        }
    }

    return (
        <div className = 'page'>
            <form>
                <div className = 'field'>
                    <input
                        readOnly
                        type            = 'text'
                        value           = { challenge }
                    />
                    <button type = 'button' onClick = {() => { navigator.clipboard.writeText ( challenge ); }}>copy</button>
                </div>
                <div className = 'field'>
                    <input
                        type            = 'text'
                        value           = { claim }
                        onChange        = {( event ) => { setClaim ( event.target.value ); }}
                    />
                    <button type = 'button' onClick = { onSubmit }>submit</button>
                </div>
                <h1 style = {{ visibility: ( status == 'none' ) ? 'hidden' : 'visible' }}>{ status }</h1>
            </form>
        </div>
    );
}

//----------------------------------------------------------------//
const root = ReactDOM.createRoot ( document.getElementById ( 'root' ));

root.render (
    <App/>
);

registerServiceWorker ();
