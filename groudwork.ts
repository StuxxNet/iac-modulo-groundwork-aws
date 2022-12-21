import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Vpc } from "@pulumi/aws/ec2";

export interface vpcOptions {
    name: string;
    cidrBlock: string;
    enableDnsHostname: boolean;
    tags?: {};
}

export interface subnetOptions {
    name: string;
    cidrBlock: string;
    availabilityZone: string;
    assignPublicAddress: boolean;
    tags?: {};
}

export interface groundWorkOptions {
    vpcOptions: vpcOptions;
    publicSubnetsOptions: subnetOptions[];
    privateSubnetsOptions: subnetOptions[];
}

export class groundWork extends pulumi.ComponentResource {

    private mainVpc: aws.ec2.Vpc;
    private internetGateway: aws.ec2.InternetGateway;
    private publicSubnets: aws.ec2.Subnet[];
    private privateSubnets: aws.ec2.Subnet[];
    private natGateway: aws.ec2.NatGateway[];
    private groundWorkOptions: groundWorkOptions;

    private defaultTags: {} = {
        "Package": "groundwork_aws",
        "Created-By": "pulumi"
    }

    constructor(name: string, groundWorkOptions: groundWorkOptions, opts?: pulumi.ResourceOptions) {
        super("modules:GroundWork", name, {}, opts);

        this.groundWorkOptions = groundWorkOptions

        // Main VPC
        this.mainVpc = this.createVpc(this.groundWorkOptions.vpcOptions);

        // Public network
        this.internetGateway = this.createInternetGateway(this.mainVpc);
        this.publicSubnets = this.createSubnets(this.mainVpc, this.groundWorkOptions.publicSubnetsOptions);

        // Private network
        this.privateSubnets = this.createSubnets(this.mainVpc, this.groundWorkOptions.privateSubnetsOptions);
        this.natGateway = this.createNatGateways(this.privateSubnets);
    }

    private createVpc(vpc: vpcOptions): aws.ec2.Vpc {
        const awsVpc = new aws.ec2.Vpc(vpc.name, {
            cidrBlock: vpc.cidrBlock,
            instanceTenancy: "default",
            enableDnsHostnames: vpc.enableDnsHostname,

            tags: {
                Name: vpc.name
            }
        }, { parent: this });

        return awsVpc;
    }

    private createInternetGateway(vpc: aws.ec2.Vpc): aws.ec2.InternetGateway {
        const awsInternetGateway = new aws.ec2.InternetGateway("internetGateway", {
            vpcId: vpc.id,
            tags: {
                Name: `Internet-Gateway`,
            },
        }, { parent: vpc });

        const defaultRouteTable = new aws.ec2.DefaultRouteTable("defaultRouteTable", {
            defaultRouteTableId: vpc.defaultRouteTableId,
            routes: [
                {
                    cidrBlock: "0.0.0.0/0",
                    gatewayId: awsInternetGateway.id,
                },
            ],
            tags: Object.assign({}, this.defaultTags, {
                Name: "PublicRoutes",
            }),
        }, { parent: awsInternetGateway });
        
        return awsInternetGateway;
    }

    private createSubnets(vpc: aws.ec2.Vpc, subnets: subnetOptions[]): aws.ec2.Subnet[] {
        let createdSubnets: aws.ec2.Subnet[] = [];

        for(const subnet of subnets){

            const awsSubnet = new aws.ec2.Subnet(subnet.name, {
                vpcId: vpc.id,
                cidrBlock: subnet.cidrBlock,
                availabilityZone: subnet.availabilityZone,
                mapPublicIpOnLaunch: subnet.assignPublicAddress,
                tags: Object.assign({}, this.defaultTags, {
                    Name: subnet.name,
                })
            }, { parent: vpc });

            createdSubnets.push(awsSubnet);
        }

        return createdSubnets;
    }

    private createNatGateways(subnets: aws.ec2.Subnet[]): aws.ec2.NatGateway[] {
        let createdNatGateways: aws.ec2.NatGateway[] = [];
        for(const [i, subnet] of subnets.entries()){

            const elasticIp = new aws.ec2.Eip(`elasticIp-${i+1}`, {}, { parent: subnet });

            const awsNatGateway = new aws.ec2.NatGateway(`natGatewayPrivateSubnet-${i+1}`, {
                allocationId: elasticIp.id,
                subnetId: subnet.id,
                tags: Object.assign({}, this.defaultTags, {
                    Name: `natGatewayPrivateSubnet-${i+1}`,
                }),
            }, { parent: subnet });

            const privateRouteTable = new aws.ec2.RouteTable(`privateRoutetable-${i+1}`, {
                vpcId: subnet.vpcId,
                routes: [
                    {
                        cidrBlock: "0.0.0.0/0",
                        natGatewayId: awsNatGateway.id,
                    },
                ],
                tags: Object.assign({}, this.defaultTags, {
                    Name: `privateRouteTable-${i+1}`,
                }),
            }, { parent: subnet })

            const routeTableAssociation = new aws.ec2.RouteTableAssociation(`privateRoutetableAssociation-${i+1}`, {
                subnetId: subnet.id,
                routeTableId: privateRouteTable.id,
            }, { parent: privateRouteTable });

            createdNatGateways.push(awsNatGateway);
        }

        return createdNatGateways;
    }

    private returnOnlyId(resources: any[]): pulumi.Output<string>[] {
        let resourcesId: pulumi.Output<string>[] = []
        for(const resource of resources){
            resourcesId.push(resource.id);
        }
        return resourcesId
    }

    public exportVpcInfos() {
        return {
            vpcId: this.mainVpc.id,
            internetGatewayid: this.internetGateway.id,
            publicSubnetsId: this.returnOnlyId(this.publicSubnets),
            privateSubnetsId: this.returnOnlyId(this.privateSubnets),
            natGatewayIds: this.returnOnlyId(this.natGateway)
        }
    }

}