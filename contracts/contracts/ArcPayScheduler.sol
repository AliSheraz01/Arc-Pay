// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ArcPayScheduler {
    IERC20 public usdc;

    struct Schedule {
        address owner;
        address[] to;
        uint256[] amounts;
        string[] memos;
        uint256 nextRun;
        uint256 interval;
        bool isActive;
    }

    mapping(string => Schedule) public schedules;

    event ScheduleCreated(string id, address indexed owner, uint256 nextRun, uint256 interval);
    event ScheduleExecuted(string id, address indexed executor, uint256 executedAt, uint256 nextRun);
    event ScheduleCancelled(string id, address indexed owner);
    event PaymentSent(address indexed from, address indexed to, uint256 amount, string memo);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createSchedule(
        string calldata id,
        address[] calldata _to,
        uint256[] calldata _amounts,
        string[] calldata _memos,
        uint256 _nextRun,
        uint256 _interval
    ) external {
        require(!schedules[id].isActive && schedules[id].owner == address(0), "Schedule already exists");
        require(_to.length == _amounts.length && _amounts.length == _memos.length, "Arrays length mismatch");
        require(_to.length > 0, "No recipients");
        
        schedules[id] = Schedule({
            owner: msg.sender,
            to: _to,
            amounts: _amounts,
            memos: _memos,
            nextRun: _nextRun,
            interval: _interval,
            isActive: true
        });

        emit ScheduleCreated(id, msg.sender, _nextRun, _interval);
    }

    function executeSchedule(string calldata id) external {
        Schedule storage schedule = schedules[id];
        require(schedule.isActive, "Schedule is not active");
        require(block.timestamp >= schedule.nextRun, "Too early to execute");

        // Pull funds and transfer
        for (uint256 i = 0; i < schedule.to.length; i++) {
            require(schedule.amounts[i] > 0, "Amount must be greater than 0");
            require(usdc.transferFrom(schedule.owner, schedule.to[i], schedule.amounts[i]), "Transfer failed");
            emit PaymentSent(schedule.owner, schedule.to[i], schedule.amounts[i], schedule.memos[i]);
        }

        if (schedule.interval > 0) {
            // Keep incrementing until it's in the future (in case keeper missed cycles)
            while (schedule.nextRun <= block.timestamp) {
                schedule.nextRun += schedule.interval;
            }
            emit ScheduleExecuted(id, msg.sender, block.timestamp, schedule.nextRun);
        } else {
            schedule.isActive = false; // One-time schedule
            emit ScheduleExecuted(id, msg.sender, block.timestamp, 0);
        }
    }

    function cancelSchedule(string calldata id) external {
        Schedule storage schedule = schedules[id];
        require(schedule.owner == msg.sender, "Only owner can cancel");
        require(schedule.isActive, "Schedule not active");
        
        schedule.isActive = false;
        emit ScheduleCancelled(id, msg.sender);
    }
}
