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
        // const operationParameters = {
        //     target: bicAddress,
        //     value: 0,
        //     data: encodeFunctionData({
        //         abi: parseAbi([
        //             'function transfer(address to, uint256 amount)'
        //         ]),
        //         functionName: 'transfer',
        //         args: [toAddress, amount]
        //     }),
        // }
        const operationParameters = {
            target: '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
            value: 0,
            data: '0x'
        }
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
        const uo = await multisigAccountClient.sendRawUserOperation(userOperationRequest, '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')
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
