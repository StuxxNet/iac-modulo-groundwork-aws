import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

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
    private publicRouteTable: aws.ec2.RouteTable;
    private privateRouteTable: aws.ec2.RouteTable;
    private awsNatGateway: aws.ec2.NatGateway;
    private groundWorkOptions: groundWorkOptions;

    private defaultTags: {} = {
        "Package": "groundwork_aws",
        "Created-By": "pulumi"
    }

    constructor(name: string, groundWorkOptions: groundWorkOptions, opts?: pulumi.ResourceOptions) {
        super("modules:GroundWork", name, {}, opts);

        this.groundWorkOptions = groundWorkOptions

        // Main VPC
        this.createVpc(this.groundWorkOptions.vpcOptions);

        // Public network
        this.createInternetGateway(this.mainVpc);
        this.publicSubnets = this.createSubnets(this.mainVpc, this.groundWorkOptions.publicSubnetsOptions, true);

        // Private network
        this.createNatGateways(this.publicSubnets[0]);
        this.privateSubnets = this.createSubnets(this.mainVpc, this.groundWorkOptions.privateSubnetsOptions, false);
    }

    private createVpc(vpc: vpcOptions) {
        this.mainVpc = new aws.ec2.Vpc(vpc.name, {
            cidrBlock: vpc.cidrBlock,
            instanceTenancy: "default",
            enableDnsHostnames: vpc.enableDnsHostname,

            tags: {
                Name: vpc.name
            }
        }, { parent: this });
    }

    private createInternetGateway(vpc: aws.ec2.Vpc) {
        this.internetGateway = new aws.ec2.InternetGateway("internetGateway", {
            vpcId: vpc.id,
            tags: {
                Name: "Internet-Gateway",
            },
        }, { parent: vpc });

        this.publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
            vpcId: this.mainVpc.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: "publicRouteTable",
            }),
        }, { parent: this.internetGateway });

        const privateroute = new aws.ec2.Route('privateRoute', {
            routeTableId: this.publicRouteTable.id,
            gatewayId: this.internetGateway.id,
            destinationCidrBlock: "0.0.0.0/0",
        }, { parent: this.publicRouteTable })

    }

    private createSubnets(vpc: aws.ec2.Vpc, subnets: subnetOptions[], isPublic: boolean): aws.ec2.Subnet[] {
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

        if(isPublic){
            for (const [i, subnet] of createdSubnets.entries()){
                const routeTableAssociation = new aws.ec2.RouteTableAssociation(`publicRoutetableAssociation-${i+1}`, {
                    subnetId: subnet.id,
                    routeTableId: this.publicRouteTable.id,
                }, { parent: subnet });
            }
        } else {
            for (const [i, subnet] of createdSubnets.entries()){
                const routeTableAssociation = new aws.ec2.RouteTableAssociation(`privateRoutetableAssociation-${i+1}`, {
                    subnetId: subnet.id,
                    routeTableId: this.privateRouteTable.id,
                }, { parent: subnet });
            }
        }

        return createdSubnets;
    }

    private createNatGateways(publicSubnet: aws.ec2.Subnet) {

        const elasticIp = new aws.ec2.Eip("elasticIp", {}, { parent: publicSubnet });

        this.awsNatGateway = new aws.ec2.NatGateway("natGatewayPrivateSubnet", {
            allocationId: elasticIp.id,
            subnetId: publicSubnet.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: "natGatewayPrivateSubnet",
            }),
        }, { parent: publicSubnet });

        this.privateRouteTable = new aws.ec2.RouteTable("privateRoutetable", {
            vpcId: this.mainVpc.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: "privateRouteTable",
            }),
        }, { parent: this.awsNatGateway });

        const privateroute = new aws.ec2.Route('privateRoute', {
            routeTableId: this.privateRouteTable.id,
            natGatewayId: this.awsNatGateway.id,
            destinationCidrBlock: "0.0.0.0/0",
        }, { parent: this.privateRouteTable })
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
            natGatewayIds: this.awsNatGateway.id
        }
    }

}