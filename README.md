# AWS IaC Module for Networking

Module that defined a basic VPC using Pulumi

## How to Consume this Module

To consume this module and create your VPC you just need to add it to your "package.json" and pass the necessary parameters

## Package.json

Here you can find a sample of a "package.json" file

```json
{
    "name": "iac-network",
    "main": "index.ts",
    "devDependencies": {
        "@types/node": "^14"
    },
    "dependencies": {
        "iac-module-network-aws": "1.0.0" // Here you can bump the package to the next versions :)
    }
}
```

## Passing Values to Consume the Module

After adding the file in the "package.json" and executing the installation you can just pass the values as below, for example:

```typescript
import { VpcOptions, SubnetOptions, NetworkOptions, Network } from "iac-module-network-aws";

const vpcDefinition: VpcOptions = {
    name: "EKS",
    cidrBlock: "10.0.0.0/16"
}

const publicSubnetsDefinition: SubnetOptions[] = [{
    name: "EKS-Public-1",
    cidrBlock: "10.0.0.0/20",
    availabilityZone: "eu-central-1a",
    assignPublicAddress: true
}, {
    name: "EKS-Public-2",
    cidrBlock: "10.0.64.0/20",
    availabilityZone: "eu-central-1a",
    assignPublicAddress: true
}]

const privateSubnetsDefinition: SubnetOptions[] = [{
    name: "EKS-Private-1",
    cidrBlock: "10.0.128.0/20",
    availabilityZone: "eu-central-1b",
    assignPublicAddress: false
}, {
    name: "EKS-Private-2",
    cidrBlock: "10.0.192.0/20",
    availabilityZone: "eu-central-1b",
    assignPublicAddress: false    
}]

const groundworkDefinition: NetworkOptions = {
    vpcOptions: vpcDefinition,
    publicSubnetsOptions: publicSubnetsDefinition,
    privateSubnetsOptions: privateSubnetsDefinition
}

const awsGroudwork = new Network("eksGroundwork", groundworkDefinition);
```