package entity

import "time"

type Message struct {
	MessageID    string    `json:"messageId"`
	SenderName   string    `json:"senderName"`
	ReceiverName string    `json:"receiverName"`
	Content      string    `json:"content"`
	Timestamp    time.Time `json:"timestamp"`
}
