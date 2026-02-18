// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Wrapper contract for ERC1967Proxy deployment
contract HoldisProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory _data) 
        ERC1967Proxy(implementation, _data) 
    {}
}
