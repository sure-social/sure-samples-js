# sure-samples-js

This is a repository of samples showing how to integrate SURE.social with your website or service.

Right now there is only one sample. It shows how to use SURE.social's doubly-anonymized "ad hoc" age verification. It is written in Javascript, but should be easy to port to any other language. See the documentation in the project folder for an explanation of how it works.

We use libsodium for our cryptography and recommend you do the same, if a port or wrapper is available in the language of your choice. If not, you will need to reac libsodium's documentation and find other implementations of the default algorithms it uses for hashing and verification.


### Endpoints

***Find an identity:***

```
GET https://api.sure.social/oai?hash=<hash of tag components>
GET https://api.sure.social/oai?uuid=<identity fingerprint>
```

If you are using a fingerprint to look up an identity, you may send that directly.

If you are using the hash param to look up an identity from a user's tag components, do not send the tag or its components to our server. Instead, send the hash:

```
import sodium from 'libsodium-wrappers';

const components = tag.trim ().toLowerCase ().split ( ':' );

const community = components [ 0 ];
const username  = components [ 1 ];
const magic     = components [ 2 ];

const plaintext = sodium.from_string ( `${ magic }${ username }${ community }` );
const hash = sodium.to_hex (
    sodium.crypto_generichash ( sodium.crypto_generichash_BYTES_MAX, plaintext )
);
```

Identites are returned in JSON format. The only guaranteed field is 'status.'

```
{
    status:         <'VALID' | 'RECOURSE' | 'INVALID' | 'PRETEND' | 'REVOKED'>
    born:           <birthYear | birthDateISO | undefined>
    minimumAge:     <minimumAge | undefined>
    name:           <fullName | undefined>
}

VALID: Identity is valid. Trust it.
RECOURSE: Identity is valid and full recourse. Trust it.
INVALID: Identity doesn't exist. Don't trust it.
PRETEND: Identity is pretend. Don't trust it.
REVOKED: Identity was revoked. Don't trust it.
```

'REVOKED' identities can only be looked up by fingerprint. Looking up a 'REVOKED' identity by a tag hash will return 'INVALID.'

***Fetch a public key:***

```
GET https://api.sure.social/sig/keys/<key name>
```

The 'key name' is just a UUID. See the 'ad hoc' sample for a more detailed explanation.

### Integrating a Blue Check

To use SURE.social as a blue check for your community, web forum, dating service, etc. just give your users a way to paste a SURE.tag into their user profile page. If you are doing an official integration, you should choose an official community name. The community name doesn't have to be unique and is entirely up to you. You don't have to tell us what it is. Just be aware that users can only provision *one identity at a time* for any given community name. So choose something fairly specific to you, such as your Discord server name or reverse URL.

Because you know the community name, and a user's username must match the unique username on their profile in your community, the only thing you need from their tag is the magic number. When a user pastes a SURE tag into their profile, make sure the community name is what you expect and the username matches exactly. Otherwise, reject the tag.

To verify a user's status and display a blue check, just GET our identity lookup endpoint using a hash of the tag, as described above. We recommend you reconstruct the tag components each time you hit the endpoint from the official community name you chose and the user's current username. We also recommend that you hit the endpoint every time you display the blue check. In fact, our ToS requires this. This will ensure that the blue check is current and will prevent users from creating multiple accounts in your community.

In addition to a blue check, you can use the contents of the identity to display any other verified claims make by the user, such as their age, minimum age, recourse status, or name.

