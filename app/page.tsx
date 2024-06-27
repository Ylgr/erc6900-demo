"use client";
import {Chain, createWalletClient, custom, CustomTransport, encodeFunctionData, formatEther, parseAbi} from "viem";
import {arbitrumSepolia, SendUserOperationParameters, UserOperationRequest, WalletClientSigner} from "@alchemy/aa-core";
import {useEffect, useState} from "react";
import { createMultisigAccountAlchemyClient } from "@alchemy/aa-alchemy";
import type {ProposeUserOperationResult} from "@alchemy/aa-accounts/dist/types/src/msca/plugins/multisig/types";
import {Signature} from "@alchemy/aa-accounts/src/msca/plugins/multisig/types";
import type {AlchemySmartAccountClient} from "@alchemy/aa-alchemy/src/client/smartAccountClient";
import type {
    AccountLoupeActions,
    MultisigModularAccount,
    MultisigPluginActions, MultisigUserOperationContext,
    PluginManagerActions
} from "@alchemy/aa-accounts";
const chain = arbitrumSepolia;

export default function Home() {
    const [address, setAddress] = useState<string>(null);
    const [eoaSigner, setEoaSigner] = useState<WalletClientSigner>(null);
    const [aaAddress, setAaAddress] = useState<string>(null);
    const [multisigAccountClient, setMultisigAccountClient] = useState(null);
    const [userOperationRequest, setUserOperationRequest] = useState<UserOperationRequest>(null);
    const [signatureOps, setSignatureOps] = useState<Signature[]>([]);
    const bicAddress = '0xe8afce87993bd475faf2aea62e0b008dc27ab81a'
    const toAddress = '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697'
    const amount = 1000000000000000000n
    const threshold = 2n;

    const operationParameters = {
        target: bicAddress,
        value: 0,
        data: encodeFunctionData({
            abi: parseAbi([
                'function transfer(address to, uint256 amount)'
            ]),
            functionName: 'transfer',
            args: [toAddress, amount]
        }),
    }

    // const operationParameters = {
    //     target: '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
    //     value: 0,
    //     data: '0x'
    // }

    const owners = [
        '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
        '0xF4402fE2B09da7c02504DC308DBc307834CE56fE',
        '0xad2ada4B2aB6B09AC980d47a314C54e9782f1D0C'
    ]

    const connectWallet = async () => {
        const [address] = await window.ethereum.request({
            method: 'eth_requestAccounts'
        })
        setAddress(address);
        console.log('window.ethereum: ', window.ethereum)
        const client = createWalletClient({
            account: address,
            chain: chain,
            transport: custom(window.ethereum),
        });
        console.log('client; ', client)
        // this can now be used as an signer for a Smart Contract Account
        const eoaSigner = new WalletClientSigner(
            client,
            "json-rpc" //signerType
        );
        console.log('eoaSigner: ', eoaSigner)
        setEoaSigner(eoaSigner);


        const multisigAccountClient = await createMultisigAccountAlchemyClient({
            chain,
            signer: eoaSigner,
            owners,
            threshold,
            apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
        });
        setMultisigAccountClient(multisigAccountClient)

        console.log('multisigAccountClient: ', multisigAccountClient)

        setAaAddress(multisigAccountClient.account.address)
    };

    const logoutWallet = async () => {
        setAddress(null);
        setEoaSigner(null);
        setAaAddress(null);
    }

    const proposeOperation = async () => {


        console.log('operationParameters: ', operationParameters)
        const operation = await multisigAccountClient.proposeUserOperation({uo: operationParameters});
        console.log('operation: ', operation)
        setUserOperationRequest(operation.request)
        setSignatureOps([operation.signatureObj])
    }

    const signProposeOperation = async () => {
        const signedOperation = await multisigAccountClient.signMultisigUserOperation({
            userOperationRequest: userOperationRequest,
            signatures: signatureOps
        })
        console.log('signedOperation: ', signedOperation)
        const userOp = userOperationRequest
        userOp.signature = signedOperation.aggregatedSignature
        setSignatureOps([...signatureOps, signedOperation.signatureObj])
        setUserOperationRequest(userOp)
    }

    const sendOperation = async () => {
        // const operationParameters: SendUserOperationParameters = {
        //     userOperationRequest: userOperationRequest,
        //     signatures: signatureOps
        // }
        // console.log('operationParameters: ', operationParameters)
        console.log('userOperationRequest: ', userOperationRequest)
        // const signedOp = await multisigAccountClient.signUserOperation({uoStruct: userOperationRequest})
        console.log('signedOp: ', {
                    uo: operationParameters,
                    context: {
                        aggregatedSignature: userOperationRequest.signature,
                        signatures: signatureOps,
                        userOpSignatureType: "ACTUAL"
                    }
                })
        const uo = await multisigAccountClient.sendUserOperation({
            uo: operationParameters,
            context: {
                aggregatedSignature: userOperationRequest.signature,
                signatures: signatureOps,
                userOpSignatureType: "ACTUAL"
            }
        });
        const txHash = await multisigAccountClient.waitForUserOperationTransaction(uo);
        console.log(txHash);
    }

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', function (accounts) {
                logoutWallet().then(() => connectWallet())
            });
        }
    }, [])


  return (
      <main className="flex min-h-screen flex-col items-center justify-between p-24">
          {!address ? <button onClick={() => connectWallet()}>Connect wallet</button> :
              <div>
                  <p>Connected with address: {address}</p>
                  <button onClick={() => logoutWallet()}>Logout wallet</button>
                    <button onClick={() => proposeOperation()}>Propose Operation</button>
                  <button onClick={() => signProposeOperation()}>Sign Operation</button>
                  <button onClick={() => sendOperation()}>Send Operation</button>
              </div>
          }

          <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
              <h2>Multisigs acccount info:</h2>
              <p>Owner: {owners.join(', ')}</p>
              <p>Threshold: {threshold.toString()}</p>
              {aaAddress && <p>AA Address: {aaAddress}</p>}
          </div>

          <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
              <h2>Example Operation:</h2>
              <p>To: {toAddress}</p>
              <p>Send {formatEther(amount)} <a href={'https://sepolia.arbiscan.io/address/' + bicAddress}>BIC</a></p>

          </div>
      </main>
  );
}

"0x000000000000000000000000000000000000000000000000000000009cfa20700000000000000000000000000000000000000000000000000000000013ab66800000000000000000000000000000000000000000000000000000000000989680649b30b4728d1ad2dd6b4b265fcd20878ff763e583c004b9aa2dc9b410013ffe0bf1e90a233ae4a0e99339d18b35b1fc77a7b523f013da8fd4006bc752f7181d1b354db785803cd25b567321aae14aaa45a2b0e0f867ccdfdcd0dc4ffbf8bbb8db1b4b7142a5084cfc94b8aef7f61fc509c7773b2e0b7b22c11f0ff7fcd2f04e381c"
"0x5285ef77486985e17de423adfc85977d118ebaad129c16a9e831b262767aeb8c38229453aa78d0eaf5a575b1d200004757376caa197ae7e2c915081918cc5c9d1c"
